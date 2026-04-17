'use strict';

const path = require('path');
const qrcode = require('qrcode');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { sendTicketConfirmation } = require('../services/mailer');

function getEvents(req, res) {
  const q        = (req.query.q        || '').trim().slice(0, 100);
  const venue    = (req.query.venue    || '').trim().slice(0, 100);
  const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
  const dateFrom = req.query.dateFrom  || null;
  const dateTo   = req.query.dateTo    || null;

  const filters = { q: q || null, venue: venue || null, minPrice, maxPrice, dateFrom, dateTo };
  //const events = Event.search(filters);
  const events = q ? Event.searchUnsafe(q) : Event.search(filters);
  res.render('events/index', { user: req.user, events, filters });
}

function getEventDetail(req, res) {
  const event = Event.findById(req.params.id);
  if (!event) {
    return res.status(404).send('<h1>404 — Event not found</h1>');
  }

  // Check if the current user already has a reserved ticket for this event
  const alreadyReserved = req.user
    ? !!Ticket.findUserTicketForEvent(req.user.id, event.id)
    : false;

  const error = req.query.error ? decodeURIComponent(req.query.error) : null;
  res.render('events/show', { user: req.user, event, alreadyReserved, error });
}

async function postReserve(req, res) {
  const event = Event.findById(req.params.id);
  if (!event) {
    return res.status(404).send('<h1>404 — Event not found</h1>');
  }

  // Check for duplicate reservation
  if (Ticket.findUserTicketForEvent(req.user.id, event.id)) {
    return res.redirect(`/events/${event.id}?error=You+already+have+a+ticket+for+this+event`);
  }

  let ticketId, ticketCode;
  try {
    const result = Ticket.reserve(req.user.id, event.id);
    ticketId = result.id;
    ticketCode = result.ticketCode;
  } catch (err) {
    if (err.message === 'NO_TICKETS_AVAILABLE') {
      return res.redirect(`/events/${event.id}?error=No+tickets+remaining+for+this+event`);
    }
    console.error('Reserve error:', err);
    return res.redirect(`/events/${event.id}?error=Reservation+failed.+Please+try+again`);
  }

  // Generate QR code — async, but ticket is already saved
  const qrFilename = `qr-${ticketCode}.png`;
  const qrFilePath = path.join(__dirname, '../public/qrcodes', qrFilename);
  const qrUrl = `/qrcodes/${qrFilename}`;

  try {
    await qrcode.toFile(qrFilePath, ticketCode, { width: 200 });
    Ticket.updateQrPath(ticketId, qrUrl);

    // Send confirmation email — non-fatal: log failures, never block the reservation
    const fullUser = User.findById(req.user.id);
    try {
      await sendTicketConfirmation({
        to: req.user.email,
        fullName: fullUser?.full_name || req.user.email,
        event,
        ticketCode,
        qrFilePath,
      });
    } catch (mailErr) {
      console.error('Email send error:', mailErr.message);
    }
  } catch (qrErr) {
    console.error('QR generation error:', qrErr);
    // Ticket is reserved — continue without QR/email rather than failing the whole reservation
  }

  User.logActivity(req.user.id, 'ticket_reserved', {
    event_id: event.id,
    ticket_code: ticketCode,
  });

  res.render('events/ticket', {
    user: req.user,
    event,
    ticketCode,
    qrUrl,
  });
}

function postCancelTicket(req, res) {
  const ticket = Ticket.findById(req.params.id);
  if (!ticket || ticket.user_id !== req.user.id) {
    return res.redirect('/profile/tickets?error=Ticket+not+found');
  }
  try {
    Ticket.cancel(req.params.id);
    User.logActivity(req.user.id, 'ticket_cancelled', {
      event_id: ticket.event_id,
      ticket_code: ticket.ticket_code,
    });
  } catch {
    return res.redirect('/profile/tickets?error=Could+not+cancel+ticket');
  }
  res.redirect('/profile/tickets?success=Ticket+cancelled');
}

module.exports = { getEvents, getEventDetail, postReserve, postCancelTicket };
