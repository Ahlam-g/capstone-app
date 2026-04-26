'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const { applySchema } = require('./schema');

const db = new Database(path.join(__dirname, 'ticketing.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

applySchema(db);

module.exports = db;
