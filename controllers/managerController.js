'use strict';

const db     = require('../database/db');
const Event  = require('../models/Event');
const Ticket = require('../models/Ticket');
const User   = require('../models/User');

function getDashboard(req, res) {
  const events = Event.findByCreator(req.user.id);
  const eventsWithStats = events.map((e) => ({
    ...e,
    reserved_count: Ticket.findByEvent(e.id).length,
  }));
  res.render('manager/dashboard', {
    user: req.user,
    events: eventsWithStats,
    error: req.query.error ? decodeURIComponent(req.query.error) : null,
    success: req.query.success ? decodeURIComponent(req.query.success) : null,
  });
}

function getNewEvent(req, res) {
  res.render('manager/event-form', { user: req.user, event: null, error: null });
}

function postCreateEvent(req, res) {
  const { title, description, date, venue, total_tickets, price } = req.body;

  if (!title || !date || !venue || !total_tickets || price === undefined) {
    return res.render('manager/event-form', {
      user: req.user,
      event: null,
      error: 'Title, date, venue, ticket count, and price are required.',
    });
  }

  const ticketCount = parseInt(total_tickets, 10);
  const priceVal = parseFloat(price);

  if (isNaN(ticketCount) || ticketCount < 1) {
    return res.render('manager/event-form', {
      user: req.user,
      event: null,
      error: 'Ticket count must be at least 1.',
    });
  }

  if (isNaN(priceVal) || priceVal < 0) {
    return res.render('manager/event-form', {
      user: req.user,
      event: null,
      error: 'Price must be 0 or greater.',
    });
  }

  const image_path = req.file ? `/uploads/events/${req.file.filename}` : null;

  Event.create({
    title: title.trim(),
    description: description?.trim() || null,
    date,
    venue: venue.trim(),
    total_tickets: ticketCount,
    price: priceVal,
    image_path,
    created_by: req.user.id,
  });

  User.logActivity(req.user.id, 'event_created', { title: title.trim() });
  res.redirect('/manager?success=Event+created+successfully');
}

function getEditEvent(req, res) {
  const event = Event.findById(req.params.id);
  if (!event || event.created_by !== req.user.id) {
    return res.redirect('/manager');
  }
  res.render('manager/event-form', { user: req.user, event, error: null });
}

function postUpdateEvent(req, res) {
  const event = Event.findById(req.params.id);
  if (!event || event.created_by !== req.user.id) {
    return res.redirect('/manager');
  }

  const { title, description, date, venue, total_tickets, price } = req.body;
  const image_path = req.file ? `/uploads/events/${req.file.filename}` : null;

  Event.update(req.params.id, {
    title: title.trim(),
    description: description?.trim() || null,
    date,
    venue: venue.trim(),
    total_tickets: parseInt(total_tickets, 10),
    price: parseFloat(price),
    image_path,
  });

  User.logActivity(req.user.id, 'event_updated', { event_id: req.params.id, title });
  res.redirect('/manager?success=Event+updated+successfully');
}

function postDeleteEvent(req, res) {
  const event = Event.findById(req.params.id);
  if (!event || event.created_by !== req.user.id) {
    return res.redirect('/manager');
  }

  Event.remove(req.params.id);
  User.logActivity(req.user.id, 'event_deleted', { event_id: req.params.id, title: event.title });
  res.redirect('/manager?success=Event+deleted');
}

function getCheckin(req, res) {
  res.render('manager/checkin', { user: req.user, result: null, error: null, code: '' });
}

function postCheckin(req, res) {
  const code    = (req.body.ticket_code || '').trim();
  const renderErr = (error) =>
    res.render('manager/checkin', { user: req.user, result: null, error, code });

  if (!code) return renderErr('Please enter a ticket code.');

  const existing = db.prepare(
    `SELECT t.*, e.created_by FROM tickets t
     JOIN events e ON e.id = t.event_id
     WHERE t.ticket_code = @code`
  ).get({ code });

  if (!existing)                           return renderErr('No ticket found with that code.');
  if (existing.created_by !== req.user.id) return renderErr('This ticket is not for one of your events.');
  if (existing.status === 'cancelled')     return renderErr('This ticket has been cancelled.');
  if (existing.checked_in)                return renderErr('This ticket was already checked in.');

  const ticket = Ticket.checkIn(code);
  User.logActivity(req.user.id, 'ticket_checked_in', { ticket_code: code, event_id: ticket.event_id });
  res.render('manager/checkin', { user: req.user, result: ticket, error: null, code: '' });
}

module.exports = {
  getDashboard,
  getNewEvent,
  postCreateEvent,
  getEditEvent,
  postUpdateEvent,
  postDeleteEvent,
  getCheckin,
  postCheckin,
};
