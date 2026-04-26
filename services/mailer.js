'use strict';

const nodemailer = require('nodemailer');

// ---------------------------------------------------------------------------
// Transporter — Mailtrap SMTP (swap credentials via env vars for production)
// ---------------------------------------------------------------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '2525', 10),
  auth: {
    user: process.env.SMTP_USER || 'YOUR_MAILTRAP_USER',
    pass: process.env.SMTP_PASS || 'YOUR_MAILTRAP_PASS',
  },
});

// ---------------------------------------------------------------------------
// sendTicketConfirmation
// ---------------------------------------------------------------------------
/**
 * Send a ticket reservation confirmation email with the QR code attached.
 *
 * @param {Object} params
 * @param {string} params.to          - Recipient email address
 * @param {string} params.fullName    - Recipient display name
 * @param {Object} params.event       - Event row (title, date, venue)
 * @param {string} params.ticketCode  - UUID ticket code
 * @param {string} params.qrFilePath  - Absolute filesystem path to the QR PNG
 */
async function sendTicketConfirmation({ to, fullName, event, ticketCode, qrFilePath }) {
  const formattedDate = new Date(event.date).toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#111;">
      <h2 style="color:#6366f1;margin-bottom:.25rem;">Reservation Confirmed!</h2>
      <p style="color:#6b7280;margin-top:0;margin-bottom:1.5rem;">
        Hi ${escHtml(fullName)}, your ticket has been reserved successfully.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;">
        <tr>
          <td style="padding:.5rem 0;color:#6b7280;width:90px;">Event</td>
          <td style="padding:.5rem 0;font-weight:600;">${escHtml(event.title)}</td>
        </tr>
        <tr>
          <td style="padding:.5rem 0;color:#6b7280;">Date</td>
          <td style="padding:.5rem 0;">${escHtml(formattedDate)}</td>
        </tr>
        <tr>
          <td style="padding:.5rem 0;color:#6b7280;">Venue</td>
          <td style="padding:.5rem 0;">${escHtml(event.venue || '—')}</td>
        </tr>
      </table>

      <p style="margin-bottom:.35rem;color:#6b7280;font-size:.875rem;">Your Ticket Code</p>
      <div style="font-family:monospace;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;
                  padding:.75rem 1rem;font-size:.95rem;word-break:break-all;margin-bottom:1.5rem;">
        ${escHtml(ticketCode)}
      </div>

      <p style="color:#374151;">
        Present this ticket code or the attached QR code at the venue entrance.
      </p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;" />
      <p style="color:#9ca3af;font-size:.8rem;">— Ticketing App</p>
    </div>
  `;

  return transporter.sendMail({
    from: '"Ticketing App" <noreply@ticketing.local>',
    to,
    subject: `Your Ticket for ${event.title}`,
    html,
    attachments: [
      {
        filename: 'ticket-qr.png',
        path: qrFilePath,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// sendPasswordResetEmail
// ---------------------------------------------------------------------------
/**
 * Send a password reset link email.
 *
 * @param {Object} params
 * @param {string} params.to          - Recipient email address
 * @param {string} params.fullName    - Recipient display name
 * @param {string} params.resetLink   - Full URL to the reset page
 */
async function sendPasswordResetEmail({ to, fullName, resetLink }) {
  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#111;">
      <h2 style="color:#6366f1;margin-bottom:.25rem;">Reset Your Password</h2>
      <p style="color:#6b7280;margin-top:0;margin-bottom:1.5rem;">
        Hi ${escHtml(fullName)}, we received a request to reset your password.
        Click the button below to choose a new one.
      </p>

      <a href="${resetLink}"
         style="display:inline-block;background:#6366f1;color:#fff;padding:.65rem 1.5rem;
                border-radius:6px;font-weight:600;text-decoration:none;margin-bottom:1.5rem;">
        Reset Password
      </a>

      <p style="color:#6b7280;font-size:.875rem;">
        This link expires in <strong>1 hour</strong>. If you didn't request a password
        reset, you can safely ignore this email.
      </p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;" />
      <p style="color:#9ca3af;font-size:.8rem;">— Ticketing App</p>
    </div>
  `;

  return transporter.sendMail({
    from: '"Ticketing App" <noreply@ticketing.local>',
    to,
    subject: 'Password Reset Request',
    html,
  });
}

/** Minimal HTML escaping for template interpolation. */
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sendTicketConfirmation, sendPasswordResetEmail };
