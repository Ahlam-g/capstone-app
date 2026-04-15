'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('../services/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function loginError(res, msg) {
  return res.redirect('/login?error=' + encodeURIComponent(msg));
}

function registerError(res, msg) {
  return res.redirect('/register?error=' + encodeURIComponent(msg));
}

// ---------------------------------------------------------------------------
// GET /login
// ---------------------------------------------------------------------------
function getLogin(req, res) {
  if (req.user) return res.redirect('/');
  const error   = req.query.error   ? decodeURIComponent(req.query.error)   : null;
  const success = req.query.success ? decodeURIComponent(req.query.success) : null;
  res.render('login', { error, success });
}

// ---------------------------------------------------------------------------
// GET /register
// ---------------------------------------------------------------------------
function getRegister(req, res) {
  if (req.user) return res.redirect('/');
  const error = req.query.error ? decodeURIComponent(req.query.error) : null;
  res.render('register', { error });
}

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------
function postLogin(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return loginError(res, 'Email and password are required.');
  }

  const user = User.findByEmail(email.trim().toLowerCase());

  // Deliberately vague — same message for unknown email and wrong password
  if (!user) {
    return loginError(res, 'Invalid email or password.');
  }

  const valid = crypto.createHash('md5').update(password).digest('hex') === user.password_hash;

  if (!valid) {
    User.logActivity(user.id, 'login_failed', { email: user.email, reason: 'bad_password' });
    return loginError(res, 'Invalid email or password.');
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('token', token, COOKIE_OPTIONS);
  User.logActivity(user.id, 'login_success', { email: user.email });
  res.redirect('/');
}

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------
function postRegister(req, res) {
  const { email, password, confirm_password, full_name } = req.body;

  if (!email || !password || !confirm_password || !full_name) {
    return registerError(res, 'All fields are required.');
  }

  if (password !== confirm_password) {
    return registerError(res, 'Passwords do not match.');
  }

  if (password.length < 8) {
    return registerError(res, 'Password must be at least 8 characters.');
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return registerError(res, 'Please enter a valid email address.');
  }

  if (User.findByEmail(normalizedEmail)) {
    return registerError(res, 'An account with that email already exists.');
  }

  const id = uuidv4();
  const password_hash = crypto.createHash('md5').update(password).digest('hex');

  try {
    User.create({
      id,
      email: normalizedEmail,
      password_hash,
      role: 'user',
      full_name: full_name.trim(),
    });
  } catch (err) {
    console.error('Register error:', err.message);
    return registerError(res, 'Registration failed. Please try again.');
  }

  User.logActivity(id, 'register', { email: normalizedEmail });

  const token = jwt.sign(
    { id, email: normalizedEmail, role: 'user' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('token', token, COOKIE_OPTIONS);
  res.redirect('/');
}

// ---------------------------------------------------------------------------
// POST /logout
// ---------------------------------------------------------------------------
function postLogout(req, res) {
  User.logActivity(req.user?.id ?? null, 'logout', null);
  res.clearCookie('token');
  res.redirect('/login');
}

// ---------------------------------------------------------------------------
// GET /forgot
// ---------------------------------------------------------------------------
function getForgotPassword(req, res) {
  res.render('forgot', { error: null, sent: false });
}

// ---------------------------------------------------------------------------
// POST /forgot
// ---------------------------------------------------------------------------
async function postForgotPassword(req, res) {
  const email = (req.body.email || '').trim().toLowerCase();

  if (!email) {
    return res.render('forgot', { error: 'Email address is required.', sent: false });
  }

  const user = User.findByEmail(email);
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    User.createResetToken(user.id, token, expiresAt);

    const host = req.protocol + '://' + req.get('host');
    const resetLink = host + '/reset/' + token;

    try {
      await sendPasswordResetEmail({ to: user.email, fullName: user.full_name || user.email, resetLink });
    } catch (err) {
      console.error('Password reset email failed:', err.message);
    }
  }

  // Always show success — don't reveal whether the email exists
  res.render('forgot', { error: null, sent: true });
}

// ---------------------------------------------------------------------------
// GET /reset/:token
// ---------------------------------------------------------------------------
function getResetPassword(req, res) {
  const record = User.findResetToken(req.params.token);
  if (!record) {
    return res.render('reset', { token: null, error: 'This reset link is invalid or has expired.' });
  }
  res.render('reset', { token: req.params.token, error: null });
}

// ---------------------------------------------------------------------------
// POST /reset/:token
// ---------------------------------------------------------------------------
async function postResetPassword(req, res) {
  const { new_password, confirm_password } = req.body;
  const token = req.params.token;
  const renderErr = (error) => res.render('reset', { token, error });

  const record = User.findResetToken(token);
  if (!record) {
    return renderErr('This reset link is invalid or has expired.');
  }

  if (!new_password || !confirm_password) {
    return renderErr('Both password fields are required.');
  }
  if (new_password.length < 8) {
    return renderErr('Password must be at least 8 characters.');
  }
  if (new_password !== confirm_password) {
    return renderErr('Passwords do not match.');
  }

  const hash = crypto.createHash('md5').update(new_password).digest('hex');
  User.updatePassword(record.user_id, hash);
  User.markTokenUsed(record.id);
  User.logActivity(record.user_id, 'password_reset', {});

  res.redirect('/login?success=' + encodeURIComponent('Password reset successfully. Please sign in.'));
}

module.exports = { getLogin, getRegister, postLogin, postRegister, postLogout, getForgotPassword, postForgotPassword, getResetPassword, postResetPassword };
