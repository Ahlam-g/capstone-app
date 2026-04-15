# Ticketing App

A full-stack event ticketing web application built with Node.js, Express, and SQLite. Users can browse events, reserve tickets, and manage their profiles. Event managers create and manage events and check in attendees. Administrators oversee all users, events, and activity across the platform.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Folder Structure](#folder-structure)
4. [Database Schema](#database-schema)
5. [Route & Endpoint Reference](#route--endpoint-reference)
6. [Feature Breakdown by Role](#feature-breakdown-by-role)
7. [Setup & Installation](#setup--installation)
8. [Environment Variables](#environment-variables)
9. [Test Credentials](#test-credentials)

---

## Project Overview

The Ticketing App is a server-rendered web application that handles the full lifecycle of event ticketing:

- **Public browsing** — anyone can search and filter upcoming events
- **Reservations** — authenticated users reserve tickets, receiving a UUID ticket code, a QR code image, and a confirmation email
- **Event management** — managers create, edit, and delete their own events with optional image uploads
- **Attendee check-in** — managers look up a ticket code at the door and mark it as checked in
- **Administration** — admins manage users (roles, bans, deletion), oversee all events and tickets, and monitor a live activity log

### Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 5.2.1 |
| Database | SQLite via `better-sqlite3` (synchronous) |
| Authentication | JWT in HTTP-only cookies (`jsonwebtoken`) |
| Password hashing | `bcryptjs` (12 rounds) |
| File uploads | `multer` (disk storage) |
| QR codes | `qrcode` |
| Email | `nodemailer` (Mailtrap SMTP placeholder) |
| Templating | EJS 5 |
| Session | `express-session` + `cookie-parser` |
| IDs | UUID v4 (`uuid`) |

---

## Architecture

```
Browser ──► Express (app.js)
              │
              ├── Global middleware
              │     ├── express.static      (public/)
              │     ├── body-parser         (JSON + urlencoded)
              │     ├── cookie-parser
              │     ├── express-session
              │     └── authenticate        (JWT decode + ban check)
              │
              ├── Routes ──► Controllers ──► Models ──► SQLite (better-sqlite3)
              │                    │
              │                    └── Services (mailer.js)
              │
              └── Views (EJS) ◄── Controllers (res.render)
```

**Key design decisions:**

- **Synchronous DB** — `better-sqlite3` runs all queries synchronously. No `async/await` on DB calls; `async` is only used for `qrcode.toFile()` and `nodemailer.sendMail()`.
- **JWT in cookies** — tokens are stored in HTTP-only, `sameSite: lax` cookies with a 7-day expiry. The global `authenticate` middleware decodes the token and performs a DB lookup on every request to enforce real-time ban status.
- **Role hierarchy** — roles are ordered `['guest', 'user', 'manager', 'admin']` by index. `requireRole('manager')` admits managers *and* admins (index ≥ 2).
- **Atomic reservations** — ticket reservation uses a `db.transaction()` to prevent overselling: it checks `tickets_remaining > 0`, decrements, and inserts the ticket row in one atomic unit.
- **Non-fatal side effects** — QR generation and email sending are wrapped in nested try/catch blocks. Failures are logged to the console but never cancel a completed reservation.

---

## Folder Structure

```
ticketing-app/
│
├── app.js                        # Entry point: middleware, route mounting, server
├── package.json
│
├── database/
│   ├── db.js                     # Opens the SQLite connection, calls applySchema + seed
│   ├── schema.js                 # CREATE TABLE statements + idempotent ALTER TABLE migrations
│   └── seed.js                   # Inserts 3 test users and 1 seed event (skips if already seeded)
│
├── middleware/
│   ├── auth.js                   # authenticate (global), requireAuth, requireRole factory
│   └── upload.js                 # Multer instance for event images (public/uploads/events/)
│
├── models/
│   ├── Event.js                  # findAll, findById, findByCreator, create, update, remove, getStats, search
│   ├── Ticket.js                 # reserve, cancel, checkIn, updateQrPath, findBy*, getCount
│   └── User.js                   # findByEmail, findById, create, update, updatePassword, logActivity
│
├── controllers/
│   ├── authController.js         # getLogin, postLogin, getRegister, postRegister, postLogout
│   ├── eventController.js        # getEvents, getEventDetail, postReserve, postCancelTicket
│   ├── managerController.js      # getDashboard, getNewEvent, postCreateEvent, getEditEvent,
│   │                             #   postUpdateEvent, postDeleteEvent, getCheckin, postCheckin
│   ├── adminController.js        # getDashboard, getUsers, postChangeRole, postDeleteUser,
│   │                             #   postBanUser, postUnbanUser, getAdminEvents,
│   │                             #   postDeleteAdminEvent, getTickets
│   └── profileController.js      # getProfile, getEditProfile, postEditProfile,
│                                 #   getPasswordChange, postPasswordChange, getMyTickets
│
├── routes/
│   ├── auth.js                   # /login, /register, /logout
│   ├── events.js                 # /events, /events/:id, /events/:id/reserve
│   ├── manager.js                # /manager/* (requires manager role)
│   ├── admin.js                  # /admin/* (requires admin role)
│   └── profile.js                # /profile/* (requires auth)
│
├── services/
│   └── mailer.js                 # Nodemailer transporter + sendTicketConfirmation()
│
├── views/
│   ├── partials/
│   │   ├── header.ejs            # Nav, global CSS, role-conditional links
│   │   └── footer.ejs            # Closing tags
│   ├── admin/
│   │   ├── dashboard.ejs         # Stats cards + activity log table
│   │   ├── events.ejs            # All events with delete
│   │   ├── tickets.ejs           # All ticket reservations
│   │   └── users.ejs             # User list with role change, delete, ban/unban
│   ├── events/
│   │   ├── index.ejs             # Event grid with search/filter form
│   │   ├── show.ejs              # Event detail + reserve button
│   │   └── ticket.ejs            # Post-reservation confirmation with QR code
│   ├── manager/
│   │   ├── dashboard.ejs         # Manager's events table
│   │   ├── event-form.ejs        # Create/edit event form (shared)
│   │   └── checkin.ejs           # Ticket code lookup + check-in result
│   ├── profile/
│   │   ├── show.ejs              # Profile overview (avatar, bio, role badge)
│   │   ├── edit.ejs              # Edit full_name, bio, profile picture
│   │   ├── password.ejs          # Change password form
│   │   └── tickets.ejs           # My Tickets list with cancel buttons
│   ├── index.ejs                 # Home page
│   ├── login.ejs
│   └── register.ejs
│
└── public/
    ├── uploads/
    │   ├── events/               # Event banner images (served statically)
    │   └── profiles/             # User profile pictures (served statically)
    └── qrcodes/                  # Generated QR code PNGs (served statically)
```

---

## Database Schema

The database is a single SQLite file created automatically in the project root on first startup. All primary keys are UUID v4 TEXT strings.

### `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `email` | TEXT | NOT NULL, UNIQUE | Stored lowercase |
| `password_hash` | TEXT | NOT NULL | bcrypt, 12 rounds |
| `role` | TEXT | DEFAULT `'user'`, CHECK | `guest` \| `user` \| `manager` \| `admin` |
| `full_name` | TEXT | | Display name |
| `bio` | TEXT | | Up to 500 chars (enforced in controller) |
| `profile_picture` | TEXT | | URL path e.g. `/uploads/profiles/…` |
| `is_banned` | INTEGER | DEFAULT `0` | `1` = banned; locks out login immediately |
| `created_at` | TEXT | DEFAULT now | ISO 8601 UTC |

### `events`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `title` | TEXT | NOT NULL | |
| `description` | TEXT | | Optional |
| `date` | TEXT | NOT NULL | ISO 8601 datetime |
| `venue` | TEXT | | |
| `total_tickets` | INTEGER | NOT NULL, ≥ 0 | Set once at creation |
| `tickets_remaining` | INTEGER | NOT NULL, ≥ 0 | Decremented on reserve, incremented on cancel |
| `price` | REAL | NOT NULL, ≥ 0 | |
| `image_path` | TEXT | | URL path e.g. `/uploads/events/…` |
| `created_by` | TEXT | FK → `users.id` ON DELETE CASCADE | |
| `created_at` | TEXT | DEFAULT now | |

### `tickets`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `user_id` | TEXT | FK → `users.id` ON DELETE CASCADE | |
| `event_id` | TEXT | FK → `events.id` ON DELETE CASCADE | |
| `ticket_code` | TEXT | NOT NULL, UNIQUE | UUID v4 — shown to user, encoded in QR |
| `qr_code_path` | TEXT | | URL path to PNG in `/public/qrcodes/` |
| `status` | TEXT | DEFAULT `'reserved'`, CHECK | `reserved` \| `cancelled` |
| `checked_in` | INTEGER | DEFAULT `0` | `1` = checked in by manager |
| `checked_in_at` | TEXT | | ISO 8601 timestamp set on check-in |
| `created_at` | TEXT | DEFAULT now | |

### `password_reset_tokens`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID v4 |
| `user_id` | TEXT | FK → `users.id` ON DELETE CASCADE |
| `token` | TEXT | UNIQUE |
| `expires_at` | TEXT | ISO 8601 |
| `used` | INTEGER | `0` or `1` |

> Schema is present but the password-reset flow is not yet wired to routes.

### `activity_log`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID v4 |
| `user_id` | TEXT | FK → `users.id` ON DELETE SET NULL — nullable for anonymous events |
| `action` | TEXT | Snake-case string e.g. `login_success`, `ticket_reserved` |
| `details` | TEXT | JSON string with contextual data |
| `created_at` | TEXT | ISO 8601 UTC |

**Logged actions:**

| Action | Trigger |
|---|---|
| `register` | New account created |
| `login_success` | Successful login |
| `login_failed` | Wrong password attempt |
| `logout` | User signs out |
| `ticket_reserved` | Ticket reservation completed |
| `ticket_cancelled` | User cancels a reservation |
| `ticket_checked_in` | Manager marks ticket as checked in |
| `password_changed` | User changes their password |
| `event_created` | Manager creates an event |
| `event_updated` | Manager edits an event |
| `event_deleted` | Manager deletes an event |
| `admin_role_changed` | Admin changes a user's role |
| `admin_user_deleted` | Admin deletes a user account |
| `admin_user_banned` | Admin bans a user |
| `admin_user_unbanned` | Admin lifts a ban |

---

## Route & Endpoint Reference

Role abbreviations: **P** = Public (no auth required) · **U** = User+ · **M** = Manager+ · **A** = Admin only

### Authentication

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/login` | P | Login page |
| POST | `/login` | P | Submit credentials; sets JWT cookie on success |
| GET | `/register` | P | Registration page |
| POST | `/register` | P | Create account; sets JWT cookie on success |
| POST | `/logout` | U | Clears JWT cookie, redirects to `/login` |

### Events

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/events` | P | Event listing with search/filter (`?q`, `?venue`, `?minPrice`, `?maxPrice`, `?dateFrom`, `?dateTo`) |
| GET | `/events/:id` | P | Event detail page |
| POST | `/events/:id/reserve` | U | Reserve a ticket; generates QR code and sends confirmation email |

### Profile

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/profile` | U | View own profile (name, bio, avatar, role) |
| GET | `/profile/edit` | U | Edit profile form |
| POST | `/profile/edit` | U | Save profile changes (name, bio, optional new avatar) |
| GET | `/profile/password` | U | Change password form |
| POST | `/profile/password` | U | Verify current password, save new hash |
| GET | `/profile/tickets` | U | List all own ticket reservations with status |
| POST | `/profile/tickets/:id/cancel` | U | Cancel a reserved ticket (returns seat to pool) |

### Manager

All `/manager` routes require **Manager or Admin** role.

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/manager` | M | Dashboard — own events with reservation counts |
| GET | `/manager/events/new` | M | New event form |
| POST | `/manager/events` | M | Create event (with optional image upload) |
| GET | `/manager/events/:id/edit` | M | Edit event form (own events only) |
| POST | `/manager/events/:id` | M | Save event edits |
| POST | `/manager/events/:id/delete` | M | Delete event (own events only) |
| GET | `/manager/checkin` | M | Ticket check-in lookup form |
| POST | `/manager/checkin` | M | Look up ticket code, validate ownership, mark checked in |

### Admin

All `/admin` routes require **Admin** role.

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/admin` | A | Dashboard — platform stats + last 50 activity log entries |
| GET | `/admin/users` | A | All user accounts with role, ban status |
| POST | `/admin/users/:id/role` | A | Change a user's role (`user` / `manager` / `admin`) |
| POST | `/admin/users/:id/delete` | A | Permanently delete a user and all their data |
| POST | `/admin/users/:id/ban` | A | Ban a user (immediate lockout) |
| POST | `/admin/users/:id/unban` | A | Lift a ban |
| GET | `/admin/events` | A | All events across all managers |
| POST | `/admin/events/:id/delete` | A | Delete any event |
| GET | `/admin/tickets` | A | All ticket reservations platform-wide |

---

## Feature Breakdown by Role

### Guest (unauthenticated)

- Browse `/events` — search by keyword, venue, date range, and price range
- View individual event detail pages
- Redirected to `/login` if attempting to reserve

### User

Everything a Guest can do, plus:

- **Reserve tickets** — one ticket per event; generates a UUID ticket code, a 200×200 QR PNG saved to `public/qrcodes/`, and sends a confirmation email with the QR as an attachment
- **My Tickets** — view all reservations with status badges (`reserved`, `cancelled`, `checked in`)
- **Cancel reservations** — cancel a `reserved` ticket; the seat is immediately returned to the event's availability pool
- **Profile** — update display name, bio, and profile picture
- **Password change** — verified against current hash before saving

### Manager

Everything a User can do, plus:

- **Event CRUD** — create, edit, and delete their own events with title, description, date, venue, ticket count, price, and an optional banner image (JPG/PNG/GIF, max 5 MB)
- **Manager dashboard** — tabular view of own events showing total capacity, reserved count, and remaining seats
- **Ticket check-in** — enter a ticket code to validate and mark an attendee as checked in; the system enforces that the ticket belongs to one of the manager's own events and rejects already-cancelled or already-checked-in tickets

### Admin

Everything a Manager can do, plus:

- **User management** — view all accounts; change any user's role; delete accounts (cascades to all their tickets); ban or unban users (banned users are locked out immediately — their JWT cookie is invalidated on the next request)
- **Event oversight** — view and delete any event platform-wide
- **Ticket oversight** — view all reservations across all events
- **Activity log** — the admin dashboard shows the 50 most recent activity log entries with timestamp, user email, action label, and details

---

## Setup & Installation

### Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later

### Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd ticketing-app

# 2. Install dependencies
npm install

# 3. (Optional) Create a .env file for custom configuration
#    See the Environment Variables section below.
#    The app runs with safe defaults if .env is omitted.

# 4. Seed the database with test users and a sample event
npm run db:seed

# 5. Start the development server
npm run dev        # uses nodemon (auto-restart on file changes)
# — or —
npm start          # plain node
```

The server starts on **http://localhost:3000** (or the port set in `PORT`).

The SQLite database file (`ticketing.db` or similar) and all upload directories are created automatically on first startup. You do not need to run any manual migrations — `schema.js` applies `CREATE TABLE IF NOT EXISTS` statements and idempotent `ALTER TABLE` migrations every time the app starts.

### Re-seeding

The seed script is idempotent — it checks whether `admin@ticketing.local` already exists and exits early if so. To reseed from scratch, delete the database file and re-run:

```bash
rm database/ticketing.db   # adjust filename as needed
npm run db:seed
```

---

## Environment Variables

All variables are optional. The app ships with development-safe defaults for every setting; only swap them in for production or to connect real SMTP credentials.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port the server listens on |
| `NODE_ENV` | `development` | Set to `production` to enable secure cookies |
| `JWT_SECRET` | `dev-secret-change-in-production` | Secret used to sign and verify JWT tokens. **Change this in production.** |
| `SESSION_SECRET` | `ticketing-app-secret` | Secret for `express-session`. **Change this in production.** |
| `SMTP_HOST` | `sandbox.smtp.mailtrap.io` | SMTP server hostname |
| `SMTP_PORT` | `2525` | SMTP server port |
| `SMTP_USER` | `YOUR_MAILTRAP_USER` | SMTP username / Mailtrap inbox user |
| `SMTP_PASS` | `YOUR_MAILTRAP_PASS` | SMTP password / Mailtrap inbox password |

### Example `.env`

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=replace-with-a-long-random-string
SESSION_SECRET=another-long-random-string

# Mailtrap sandbox (https://mailtrap.io)
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_mailtrap_user
SMTP_PASS=your_mailtrap_pass
```

### Configuring email (Mailtrap)

1. Create a free account at [mailtrap.io](https://mailtrap.io)
2. Open your inbox → **SMTP Settings** → copy the credentials
3. Set `SMTP_USER` and `SMTP_PASS` in `.env`

All outbound emails (ticket confirmations with QR attachment) will appear in the Mailtrap inbox instead of being delivered to real addresses — ideal for development and testing.

---

## Test Credentials

These accounts are created by `npm run db:seed`.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@ticketing.local` | `Admin1234!` |
| Manager | `manager@ticketing.local` | `Manager1234!` |
| User | `user@ticketing.local` | `User1234!` |

A single seed event is also created:

| Field | Value |
|---|---|
| Title | Opening Night Concert |
| Venue | The Grand Arena |
| Date | June 15, 2026 at 7:00 PM UTC |
| Price | $49.99 |
| Capacity | 200 tickets |
| Created by | manager@ticketing.local |

### Quick smoke test

1. `npm run db:seed && npm run dev`
2. Log in as **user@ticketing.local**
3. Browse to `/events` → click the seed event → reserve a ticket
4. Check `public/qrcodes/` — a QR PNG should appear
5. Check your Mailtrap inbox — a confirmation email with QR attachment should arrive
6. Go to `/profile/tickets` → cancel the ticket → event availability increments back to 200
7. Log in as **manager@ticketing.local** → go to `/manager/checkin` → paste the ticket code → verify the "already cancelled" error
8. Log in as **admin@ticketing.local** → visit `/admin` → confirm the activity log shows all of the above actions
