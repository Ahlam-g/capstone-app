'use strict';

const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Atomically reserve a ticket for a user.
 * Throws an error with message 'NO_TICKETS_AVAILABLE' if sold out.
 * Returns { id, ticketCode } on success.
 */
function reserve(userId, eventId) {
  const ticketId = uuidv4();
  const ticketCode = uuidv4();

  const tx = db.transaction(() => {
    const event = db
      .prepare('SELECT tickets_remaining FROM events WHERE id = @eventId')
      .get({ eventId });

    if (!event || event.tickets_remaining <= 0) {
      throw new Error('NO_TICKETS_AVAILABLE');
    }

    db.prepare(
      'UPDATE events SET tickets_remaining = tickets_remaining - 1 WHERE id = @eventId'
    ).run({ eventId });

    db.prepare(
      `INSERT INTO tickets (id, user_id, event_id, ticket_code, status)
       VALUES (@id, @userId, @eventId, @ticketCode, 'reserved')`
    ).run({ id: ticketId, userId, eventId, ticketCode });

    return { id: ticketId, ticketCode };
  });

  return tx();
}

function updateQrPath(id, qrCodePath) {
  db.prepare('UPDATE tickets SET qr_code_path = @qrCodePath WHERE id = @id').run({ id, qrCodePath });
}

function findByUser(userId) {
  return db
    .prepare(
      `SELECT t.*, e.title AS event_title, e.date AS event_date, e.venue AS event_venue
       FROM tickets t
       JOIN events e ON e.id = t.event_id
       WHERE t.user_id = @userId
       ORDER BY t.created_at DESC`
    )
    .all({ userId });
}

function findUserTicketForEvent(userId, eventId) {
  return db
    .prepare(
      `SELECT id FROM tickets
       WHERE user_id = @userId AND event_id = @eventId AND status = 'reserved'`
    )
    .get({ userId, eventId });
}

function findById(id) {
  return db
    .prepare(
      `SELECT t.*,
              e.title AS event_title, e.date AS event_date, e.venue AS event_venue,
              u.email AS user_email, u.full_name AS user_name
       FROM tickets t
       JOIN events e ON e.id = t.event_id
       JOIN users  u ON u.id = t.user_id
       WHERE t.id = @id`
    )
    .get({ id });
}

function findAll() {
  return db
    .prepare(
      `SELECT t.*,
              e.title AS event_title,
              u.email AS user_email, u.full_name AS user_name
       FROM tickets t
       JOIN events e ON e.id = t.event_id
       JOIN users  u ON u.id = t.user_id
       ORDER BY t.created_at DESC`
    )
    .all();
}

function findByEvent(eventId) {
  return db
    .prepare(
      `SELECT t.*, u.email AS user_email, u.full_name AS user_name
       FROM tickets t
       JOIN users u ON u.id = t.user_id
       WHERE t.event_id = @eventId`
    )
    .all({ eventId });
}

function cancel(ticketId) {
  const tx = db.transaction(() => {
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = @id').get({ id: ticketId });
    if (!ticket || ticket.status !== 'reserved') throw new Error('CANNOT_CANCEL');
    db.prepare("UPDATE tickets SET status = 'cancelled' WHERE id = @id").run({ id: ticketId });
    db.prepare('UPDATE events SET tickets_remaining = tickets_remaining + 1 WHERE id = @eventId')
      .run({ eventId: ticket.event_id });
    return ticket;
  });
  return tx();
}

function checkIn(ticketCode) {
  const ticket = db.prepare('SELECT * FROM tickets WHERE ticket_code = @ticketCode').get({ ticketCode });
  if (!ticket)                       throw new Error('TICKET_NOT_FOUND');
  if (ticket.status === 'cancelled') throw new Error('TICKET_CANCELLED');
  if (ticket.checked_in)             throw new Error('ALREADY_CHECKED_IN');

  const now = new Date().toISOString();
  db.prepare('UPDATE tickets SET checked_in = 1, checked_in_at = @now WHERE id = @id')
    .run({ id: ticket.id, now });

  return findById(ticket.id);
}

function getCount() {
  return db.prepare('SELECT COUNT(*) AS total FROM tickets').get().total;
}

module.exports = {
  reserve,
  updateQrPath,
  findByUser,
  findUserTicketForEvent,
  findById,
  findAll,
  findByEvent,
  getCount,
  cancel,
  checkIn,
};
