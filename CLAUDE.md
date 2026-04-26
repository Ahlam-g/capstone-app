# CLAUDE.md — Ticketing App

## Project Overview

A full-stack event ticketing web application built with Node.js and Express. Users can browse events and reserve tickets; event managers can create events and check in attendees; admins oversee the full platform.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v18+ |
| Framework | Express 5.x |
| Database | SQLite via `better-sqlite3` (synchronous driver) |
| Auth | JWT in HTTP-only cookies (7-day expiry) + express-session |
| Passwords | bcryptjs (12 rounds) |
| Templating | EJS |
| File Uploads | multer (5MB max, disk storage) |
| QR Codes | qrcode (async) |
| Email | nodemailer → Mailtrap SMTP |
| IDs | uuid v4 |

## Running the App

```bash
npm start          # production
npm run dev        # nodemon watch mode
npm run db:seed    # seed test users + sample event
```

Server listens on `PORT` (default 3000).

## Environment Variables

All have development defaults; no `.env` is required to run locally.

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | |
| `NODE_ENV` | `development` | Set to `production` for secure cookies |
| `JWT_SECRET` | `dev-secret-change-in-production` | **Must change in production** |
| `SESSION_SECRET` | `ticketing-app-secret` | **Must change in production** |
| `SMTP_HOST` | `sandbox.smtp.mailtrap.io` | |
| `SMTP_PORT` | `2525` | |
| `SMTP_USER` | *(unset)* | Mailtrap credentials |
| `SMTP_PASS` | *(unset)* | Mailtrap credentials |

## Test Credentials (seeded)

| Role | Email | Password |
|---|---|---|
| Admin | admin@ticketing.local | Admin1234! |
| Manager | manager@ticketing.local | Manager1234! |
| User | user@ticketing.local | User1234! |

## Architecture

The app follows a standard MVC pattern with thin routes, controller logic, and model-level DB queries.

```
app.js                  # Express setup, middleware, route mounting, error handlers
database/
  db.js                 # Opens ticketing.db with WAL mode + foreign keys
  schema.js             # CREATE TABLE statements + idempotent column migrations
  seed.js               # Test data (run once)
middleware/
  auth.js               # JWT decode, ban check, requireAuth, requireRole()
  upload.js             # Multer config
models/
  User.js               # findByEmail, findById, create, update, logActivity
  Event.js              # findAll, findById, create, update, remove, search, getStats
  Ticket.js             # reserve (atomic transaction), cancel, checkIn, findBy*
controllers/
  authController.js     # login / register / logout
  eventController.js    # browse events, reserve ticket (+ QR + email)
  profileController.js  # view/edit profile, change password, list tickets
  managerController.js  # event CRUD, check-in workflow
  adminController.js    # user/event/ticket management, ban/unban, role changes
routes/
  auth.js               # /login  /register  /logout
  events.js             # /events  /events/:id  /events/:id/reserve
  profile.js            # /profile/*  /profile/tickets/:id/cancel
  manager.js            # /manager/events/*  /manager/checkin
  admin.js              # /admin/*
services/
  mailer.js             # sendTicketConfirmation() with QR attachment
views/                  # EJS templates (partials/header.ejs + footer.ejs)
public/
  uploads/events/       # Event banner images (served statically)
  uploads/profiles/     # User profile pictures (served statically)
  qrcodes/              # Auto-generated QR PNGs (served statically)
```

## Key Patterns

### Synchronous Database
`better-sqlite3` is synchronous — **do not add async/await to model methods**. Transactions use `db.transaction()`. The only async operations are `qrcode.toFile()` and `nodemailer.sendMail()`.

### Role Hierarchy
Roles ordered: `['guest', 'user', 'manager', 'admin']`. `requireRole('manager')` admits managers and admins (index-based comparison). Ban status is re-checked against the DB on every request regardless of JWT validity.

### Atomic Ticket Reservation
`Ticket.reserve()` wraps in a `db.transaction()`: checks `tickets_remaining > 0`, decrements, inserts ticket atomically. Prevents race conditions.

### Non-Fatal Side Effects
QR code generation and email delivery are fire-and-forget inside nested try/catch blocks inside the reservation controller. Failures are console-logged but never roll back a committed reservation.

### File Uploads
Multer stores to disk. Accepted MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`. 5MB limit. Uploaded files are served via `express.static('public')`.

## Database Schema

**`users`** — id (UUID), email (unique), password_hash, role, full_name, bio, profile_picture, is_banned, created_at

**`events`** — id (UUID), title, description, date, venue, total_tickets, tickets_remaining, price, image_path, created_by (FK→users), created_at

**`tickets`** — id (UUID), user_id (FK), event_id (FK), ticket_code (UUID, unique), qr_code_path, status (reserved|cancelled), checked_in, checked_in_at, created_at

**`activity_log`** — id, user_id (nullable), action (snake_case string), details (JSON string), created_at

**`password_reset_tokens`** — table exists in schema but is not wired to any route.

## Route Access Matrix

| Route | Minimum Role |
|---|---|
| GET /events, /events/:id | Public |
| GET /login, /register | Public |
| POST /events/:id/reserve | user |
| GET/POST /profile/* | user |
| GET/POST /manager/* | manager |
| GET/POST /admin/* | admin |

## Activity Log Actions

`register`, `login_success`, `login_failed`, `logout`, `ticket_reserved`, `ticket_cancelled`, `ticket_checked_in`, `password_changed`, `event_created`, `event_updated`, `event_deleted`, `admin_role_changed`, `admin_user_deleted`, `admin_user_banned`, `admin_user_unbanned`

## Known Gaps / Unfinished Features

- Password reset flow: `password_reset_tokens` table exists but no routes or UI are implemented.
- No input sanitization beyond basic validation — XSS risk in EJS templates if `<%=` is used without escaping.
- `NODE_ENV=development` default means cookies are not `secure` unless overridden.
- No rate limiting on login or reservation endpoints.
