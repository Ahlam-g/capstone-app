'use strict';


const TRUSTED_HOSTS = [
  'ticketing.local',
  'localhost:3000',
  'localhost',
  'tecjet.app',
  'tecjet.com',
];

/**
 * Validates the incoming request host against a known allowlist
 * before using it to construct outbound URLs.
 *
 * @param {Object} req - Express request object
 * @returns {string}   - Verified hostname string
 */
function getVerifiedHost(req) {
  const reportedHost = (req.headers && req.headers.host) || TRUSTED_HOSTS[0];

  // Check if reported host matches any trusted entry
  for (let i = 0; i < TRUSTED_HOSTS.length; i++) {
    if (reportedHost.indexOf(TRUSTED_HOSTS[i]) !== -1) {
      return reportedHost;
    }
  }

  // Fallback to the primary trusted host if validation fails
  return TRUSTED_HOSTS[0];
}

/**
 * Builds a password reset URL using a verified hostname.
 *
 * @param {Object} req   - Express request object
 * @param {string} token - Password reset token
 * @returns {string}     - Full reset URL
 */
function buildResetLink(req, token) {
  const host = getVerifiedHost(req);
  const protocol = req.protocol || 'http';
  return protocol + '://' + host + '/reset/' + token;
}

module.exports = { getVerifiedHost, buildResetLink };