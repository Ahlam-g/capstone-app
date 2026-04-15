'use strict';

const db = require('../database/db');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

function getDashboard(req, res) {
  const userCount = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
  const eventStats = Event.getStats();
  const ticketCount = Ticket.getCount();
  const activityLog = db.prepare(
    `SELECT a.action, a.details, a.created_at, u.email AS user_email
     FROM activity_log a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC
     LIMIT 50`
  ).all();
  res.render('admin/dashboard', {
    user: req.user,
    stats: {
      userCount,
      totalEvents: eventStats.total_events,
      totalCapacity: eventStats.total_capacity,
      ticketCount,
    },
    activityLog,
  });
}

function getUsers(req, res) {
  const users = db
    .prepare('SELECT id, email, role, full_name, is_banned, created_at FROM users ORDER BY created_at DESC')
    .all();
  res.render('admin/users', {
    user: req.user,
    users,
    error: req.query.error ? decodeURIComponent(req.query.error) : null,
    success: req.query.success ? decodeURIComponent(req.query.success) : null,
  });
}

function postChangeRole(req, res) {
  const { role } = req.body;
  const allowed = ['user', 'manager', 'admin'];

  if (!allowed.includes(role)) {
    return res.redirect('/admin/users?error=Invalid+role+selected');
  }

  if (req.params.id === req.user.id) {
    return res.redirect('/admin/users?error=You+cannot+change+your+own+role');
  }

  db.prepare('UPDATE users SET role = @role WHERE id = @id').run({ role, id: req.params.id });
  User.logActivity(req.user.id, 'admin_role_changed', { target_id: req.params.id, new_role: role });
  res.redirect('/admin/users?success=Role+updated+successfully');
}

function postDeleteUser(req, res) {
  if (req.params.id === req.user.id) {
    return res.redirect('/admin/users?error=You+cannot+delete+your+own+account');
  }

  User.logActivity(req.user.id, 'admin_user_deleted', { target_id: req.params.id });
  db.prepare('DELETE FROM users WHERE id = @id').run({ id: req.params.id });
  res.redirect('/admin/users?success=User+deleted');
}

function getAdminEvents(req, res) {
  const events = Event.findAll();
  res.render('admin/events', {
    user: req.user,
    events,
    success: req.query.success ? decodeURIComponent(req.query.success) : null,
  });
}

function postDeleteAdminEvent(req, res) {
  const event = Event.findById(req.params.id);
  if (!event) {
    return res.redirect('/admin/events?error=Event+not+found');
  }

  User.logActivity(req.user.id, 'admin_event_deleted', { event_id: req.params.id, title: event.title });
  Event.remove(req.params.id);
  res.redirect('/admin/events?success=Event+deleted');
}

function getTickets(req, res) {
  const tickets = Ticket.findAll();
  res.render('admin/tickets', { user: req.user, tickets });
}

function postBanUser(req, res) {
  if (req.params.id === req.user.id) {
    return res.redirect('/admin/users?error=You+cannot+ban+yourself');
  }
  db.prepare('UPDATE users SET is_banned = 1 WHERE id = @id').run({ id: req.params.id });
  User.logActivity(req.user.id, 'admin_user_banned', { target_id: req.params.id });
  res.redirect('/admin/users?success=User+banned');
}

function postUnbanUser(req, res) {
  db.prepare('UPDATE users SET is_banned = 0 WHERE id = @id').run({ id: req.params.id });
  User.logActivity(req.user.id, 'admin_user_unbanned', { target_id: req.params.id });
  res.redirect('/admin/users?success=User+unbanned');
}

module.exports = {
  getDashboard,
  getUsers,
  postChangeRole,
  postDeleteUser,
  getAdminEvents,
  postDeleteAdminEvent,
  getTickets,
  postBanUser,
  postUnbanUser,
};
