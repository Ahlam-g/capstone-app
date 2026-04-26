'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

function seed() {
  const existingAdmin = db
    .prepare("SELECT id FROM users WHERE email = 'admin@ticketing.local'")
    .get();

  if (existingAdmin) {
    console.log('Database already seeded. Skipping.');
    return;
  }

  const adminId   = uuidv4();
  const managerId = uuidv4();
  const userId    = uuidv4();
  const eventId   = uuidv4();

  const adminHash   = crypto.createHash('md5').update('Admin1234!').digest('hex');
  const managerHash = crypto.createHash('md5').update('Manager1234!').digest('hex');
  const userHash    = crypto.createHash('md5').update('User1234!').digest('hex');

  const runSeed = db.transaction(() => {
    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, role, full_name)
      VALUES (@id, @email, @password_hash, @role, @full_name)
    `);

    insertUser.run({
      id: adminId,
      email: 'admin@ticketing.local',
      password_hash: adminHash,
      role: 'admin',
      full_name: 'System Administrator',
    });

    insertUser.run({
      id: managerId,
      email: 'manager@ticketing.local',
      password_hash: managerHash,
      role: 'manager',
      full_name: 'Event Manager',
    });

    insertUser.run({
      id: userId,
      email: 'user@ticketing.local',
      password_hash: userHash,
      role: 'user',
      full_name: 'Regular User',
    });

    db.prepare(`
      INSERT INTO events
        (id, title, description, date, venue,
         total_tickets, tickets_remaining, price, created_by)
      VALUES
        (@id, @title, @description, @date, @venue,
         @total_tickets, @tickets_remaining, @price, @created_by)
    `).run({
      id: eventId,
      title: 'Opening Night Concert',
      description: 'A spectacular opening night featuring live performances.',
      date: '2026-06-15T19:00:00Z',
      venue: 'The Grand Arena',
      total_tickets: 200,
      tickets_remaining: 200,
      price: 49.99,
      created_by: managerId,
    });

    const logAction = db.prepare(`
      INSERT INTO activity_log (id, user_id, action, details)
      VALUES (@id, @user_id, @action, @details)
    `);

    logAction.run({
      id: uuidv4(), user_id: adminId,
      action: 'SEED_USER_CREATED',
      details: 'Admin user created during database seed',
    });
    logAction.run({
      id: uuidv4(), user_id: adminId,
      action: 'SEED_USER_CREATED',
      details: 'Manager user created during database seed',
    });
    logAction.run({
      id: uuidv4(), user_id: adminId,
      action: 'SEED_USER_CREATED',
      details: 'Regular user created during database seed',
    });
    logAction.run({
      id: uuidv4(), user_id: managerId,
      action: 'SEED_EVENT_CREATED',
      details: `Event "${eventId}" created during database seed`,
    });
  });

  runSeed();

  console.log('Database seeded successfully.\n');
  console.log('  Role     | Email                    | Password');
  console.log('  ---------|--------------------------|-------------');
  console.log('  admin    | admin@ticketing.local    | Admin1234!');
  console.log('  manager  | manager@ticketing.local  | Manager1234!');
  console.log('  user     | user@ticketing.local     | User1234!');
}

seed();
