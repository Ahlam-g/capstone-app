'use strict';

const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

function findAll() {
  return db
    .prepare(
      `SELECT e.*, u.full_name AS creator_name
       FROM events e
       JOIN users u ON u.id = e.created_by
       ORDER BY e.date ASC`
    )
    .all();
}

function findById(id) {
  return db
    .prepare(
      `SELECT e.*, u.full_name AS creator_name
       FROM events e
       JOIN users u ON u.id = e.created_by
       WHERE e.id = @id`
    )
    .get({ id });
}

function findByCreator(createdBy) {
  return db
    .prepare(
      `SELECT * FROM events
       WHERE created_by = @createdBy
       ORDER BY date ASC`
    )
    .all({ createdBy });
}

function create({ title, description, date, venue, total_tickets, price, image_path, created_by }) {
  const id = uuidv4();
  db.prepare(
    `INSERT INTO events
       (id, title, description, date, venue, total_tickets, tickets_remaining, price, image_path, created_by)
     VALUES
       (@id, @title, @description, @date, @venue, @total_tickets, @total_tickets, @price, @image_path, @created_by)`
  ).run({ id, title, description: description || null, date, venue, total_tickets, price, image_path: image_path || null, created_by });
  return id;
}

function update(id, { title, description, date, venue, total_tickets, price, image_path }) {
  db.prepare(
    `UPDATE events
     SET title = @title,
         description = @description,
         date = @date,
         venue = @venue,
         total_tickets = @total_tickets,
         price = @price,
         image_path = COALESCE(@image_path, image_path)
     WHERE id = @id`
  ).run({ id, title, description: description || null, date, venue, total_tickets, price, image_path: image_path || null });
}

function remove(id) {
  db.prepare('DELETE FROM events WHERE id = @id').run({ id });
}

function getStats() {
  return db
    .prepare(
      `SELECT
         COUNT(*) AS total_events,
         COALESCE(SUM(total_tickets), 0)     AS total_capacity,
         COALESCE(SUM(tickets_remaining), 0) AS remaining
       FROM events`
    )
    .get();
}

function search({ q, venue, minPrice, maxPrice, dateFrom, dateTo } = {}) {
  const conditions = [];
  const params = {};

  if (q) {
    conditions.push('(e.title LIKE @q OR e.venue LIKE @q)');
    params.q = `%${q}%`;
  }
  if (venue) {
    conditions.push('e.venue LIKE @venue');
    params.venue = `%${venue}%`;
  }
  if (minPrice != null) { conditions.push('e.price >= @minPrice'); params.minPrice = minPrice; }
  if (maxPrice != null) { conditions.push('e.price <= @maxPrice'); params.maxPrice = maxPrice; }
  if (dateFrom)         { conditions.push('e.date >= @dateFrom');  params.dateFrom = dateFrom; }
  if (dateTo)           { conditions.push('e.date <= @dateTo');    params.dateTo = dateTo; }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  return db.prepare(
    `SELECT e.*, u.full_name AS creator_name
     FROM events e JOIN users u ON u.id = e.created_by
     ${where} ORDER BY e.date ASC`
  ).all(params);
}

function searchUnsafe(q) {
  return db.prepare(
    "SELECT e.*, u.full_name AS creator_name FROM events e " +
    "JOIN users u ON u.id = e.created_by " +
    "WHERE e.title LIKE '%" + q + "%' " +
    "OR e.venue LIKE '%" + q + "%' " +
    "ORDER BY e.date ASC"
  ).all();
}

module.exports = { findAll, findById, findByCreator, create, update, remove, getStats, search, searchUnsafe };
