'use strict';

function applySchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id               TEXT PRIMARY KEY,
      email            TEXT NOT NULL UNIQUE,
      password_hash    TEXT NOT NULL,
      role             TEXT NOT NULL DEFAULT 'user'
                         CHECK(role IN ('guest', 'user', 'manager', 'admin')),
      full_name        TEXT,
      bio              TEXT,
      profile_picture  TEXT,
      created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id                TEXT PRIMARY KEY,
      title             TEXT NOT NULL,
      description       TEXT,
      date              TEXT NOT NULL,
      venue             TEXT,
      total_tickets     INTEGER NOT NULL CHECK(total_tickets >= 0),
      tickets_remaining INTEGER NOT NULL CHECK(tickets_remaining >= 0),
      price             REAL    NOT NULL CHECK(price >= 0),
      image_path        TEXT,
      created_by        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
      event_id      TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      ticket_code   TEXT NOT NULL UNIQUE,
      qr_code_path  TEXT,
      status        TEXT NOT NULL DEFAULT 'reserved'
                      CHECK(status IN ('reserved', 'cancelled')),
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token       TEXT NOT NULL UNIQUE,
      expires_at  TEXT NOT NULL,
      used        INTEGER NOT NULL DEFAULT 0 CHECK(used IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id         TEXT PRIMARY KEY,
      user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
      action     TEXT NOT NULL,
      details    TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  // Migrations: add columns to existing tables (idempotent)
  const userCols = db.pragma('table_info(users)').map(c => c.name);
  if (!userCols.includes('is_banned')) {
    db.exec('ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0');
  }

  const ticketCols = db.pragma('table_info(tickets)').map(c => c.name);
  if (!ticketCols.includes('checked_in')) {
    db.exec('ALTER TABLE tickets ADD COLUMN checked_in INTEGER NOT NULL DEFAULT 0');
    db.exec('ALTER TABLE tickets ADD COLUMN checked_in_at TEXT');
  }
}

module.exports = { applySchema };
