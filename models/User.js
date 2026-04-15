'use strict';

const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = @email').get({ email });
}

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = @id').get({ id });
}

function create({ id, email, password_hash, role, full_name }) {
  return db.prepare(
    `INSERT INTO users (id, email, password_hash, role, full_name)
     VALUES (@id, @email, @password_hash, @role, @full_name)`
  ).run({ id, email, password_hash, role, full_name });
}

function logActivity(userId, action, details) {
  const detailsStr =
    details && typeof details === 'object' ? JSON.stringify(details) : (details ?? null);

  db.prepare(
    `INSERT INTO activity_log (id, user_id, action, details)
     VALUES (@id, @userId, @action, @details)`
  ).run({ id: uuidv4(), userId: userId ?? null, action, details: detailsStr });
}

function update(id, { full_name, bio, profile_picture }) {
  db.prepare(
    `UPDATE users
     SET full_name = @full_name,
         bio = @bio,
         profile_picture = COALESCE(@profile_picture, profile_picture)
     WHERE id = @id`
  ).run({ id, full_name: full_name || null, bio: bio || null, profile_picture: profile_picture || null });
}

function updatePassword(id, password_hash) {
  db.prepare('UPDATE users SET password_hash = @password_hash WHERE id = @id')
    .run({ id, password_hash });
}

function createResetToken(userId, token, expiresAt) {
  db.prepare(
    `INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
     VALUES (@id, @userId, @token, @expiresAt)`
  ).run({ id: uuidv4(), userId, token, expiresAt });
}

function findResetToken(token) {
  return db.prepare(
    `SELECT t.*, u.email, u.full_name, u.id AS user_id
     FROM password_reset_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token = @token
       AND t.used = 0
       AND t.expires_at > @now`
  ).get({ token, now: new Date().toISOString() });
}

function markTokenUsed(id) {
  db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = @id').run({ id });
}

module.exports = { findByEmail, findById, create, logActivity, update, updatePassword, createResetToken, findResetToken, markTokenUsed };
