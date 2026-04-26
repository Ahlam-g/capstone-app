'use strict';

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Index position encodes privilege level — higher index = more privilege.
// requireRole('manager') admits managers AND admins (index >= 2).
const ROLE_HIERARCHY = ['guest', 'user', 'manager', 'admin'];

/**
 * Global middleware — reads JWT cookie and attaches decoded payload to req.user.
 * Sets req.user = null if cookie is absent or token is invalid/expired.
 * Never terminates the request.
 */
function authenticate(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const dbUser  = User.findById(decoded.id);
    if (!dbUser || dbUser.is_banned) {
      res.clearCookie('token');
      req.user = null;
    } else {
      req.user = decoded;
    }
  } catch {
    res.clearCookie('token');
    req.user = null;
  }

  next();
}

/**
 * Route guard — redirects to /login if user is not authenticated.
 * Must be placed after authenticate in the middleware chain.
 */
function requireAuth(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

/**
 * Role guard factory — returns middleware that enforces a minimum role level.
 * Passing multiple roles allows the lowest one as the minimum threshold.
 *
 * Usage:
 *   router.get('/dashboard', requireAuth, requireRole('user'), handler)
 *   router.get('/manage',    requireAuth, requireRole('manager'), handler)
 *   router.get('/admin',     requireAuth, requireRole('admin'), handler)
 *
 * @param {...string} roles - Accepted role names (at least one required)
 */
function requireRole(...roles) {
  const minIndex = Math.min(
    ...roles.map((r) => {
      const idx = ROLE_HIERARCHY.indexOf(r);
      if (idx === -1) throw new Error(`requireRole: unknown role "${r}"`);
      return idx;
    })
  );

  return function roleGuard(req, res, next) {
    if (!req.user) return res.redirect('/login');

    const userIndex = ROLE_HIERARCHY.indexOf(req.user.role);

    if (userIndex >= minIndex) return next();

    res.status(403).send(
      '<h1>403 — Forbidden</h1><p>You do not have permission to access this page.</p>'
    );
  };
}

module.exports = { authenticate, requireAuth, requireRole };
