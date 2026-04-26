'use strict';

const bcrypt = require('bcryptjs');
const User   = require('../models/User');
const Ticket = require('../models/Ticket');

const BCRYPT_ROUNDS = 12;

function getProfile(req, res) {
  const profile = User.findById(req.user.id);
  const success = req.query.success ? decodeURIComponent(req.query.success) : null;
  res.render('profile/show', { user: req.user, profile, success });
}

function getEditProfile(req, res) {
  const profile = User.findById(req.user.id);
  res.render('profile/edit', { user: req.user, profile, error: null });
}

function postEditProfile(req, res) {
  const full_name = (req.body.full_name || '').trim().slice(0, 100);
  const bio       = (req.body.bio       || '').trim().slice(0, 500);

  if (!full_name) {
    const profile = User.findById(req.user.id);
    return res.render('profile/edit', { user: req.user, profile, error: 'Display name is required.' });
  }

  const profile_picture = req.file ? '/uploads/profiles/' + req.file.filename : null;
  User.update(req.user.id, { full_name, bio, profile_picture });
  res.redirect('/profile');
}

function getPasswordChange(req, res) {
  res.render('profile/password', { user: req.user, error: null });
}

async function postPasswordChange(req, res) {
  const { current_password, new_password, confirm_password } = req.body;
  const renderErr = (error) => res.render('profile/password', { user: req.user, error });

  if (!current_password || !new_password || !confirm_password)
    return renderErr('All fields are required.');
  if (new_password !== confirm_password)
    return renderErr('New passwords do not match.');
  if (new_password.length < 8)
    return renderErr('New password must be at least 8 characters.');

  const dbUser = User.findById(req.user.id);
  const valid  = bcrypt.compareSync(current_password, dbUser.password_hash);
  if (!valid) return renderErr('Current password is incorrect.');

  const hash = bcrypt.hashSync(new_password, BCRYPT_ROUNDS);
  User.updatePassword(req.user.id, hash);
  User.logActivity(req.user.id, 'password_changed', {});

  res.redirect('/profile?success=Password+changed+successfully');
}

function getMyTickets(req, res) {
  const tickets = Ticket.findByUser(req.user.id);
  const error   = req.query.error   ? decodeURIComponent(req.query.error)   : null;
  const success = req.query.success ? decodeURIComponent(req.query.success) : null;
  res.render('profile/tickets', { user: req.user, tickets, error, success });
}

function getTicketDetail(req, res) {
  const ticket = Ticket.findById(req.params.id);
  if (!ticket || ticket.user_id !== req.user.id) {
    return res.redirect('/profile/tickets?error=' + encodeURIComponent('Ticket not found.'));
  }
  res.render('profile/ticket-detail', { user: req.user, ticket });
}

module.exports = { getProfile, getEditProfile, postEditProfile, getPasswordChange, postPasswordChange, getMyTickets, getTicketDetail };
