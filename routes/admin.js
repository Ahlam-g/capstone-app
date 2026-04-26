'use strict';

const { Router } = require('express');
const {
  getDashboard,
  getUsers,
  postChangeRole,
  postDeleteUser,
  getAdminEvents,
  postDeleteAdminEvent,
  getTickets,
  postBanUser,
  postUnbanUser,
} = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/auth');

// I ADDED THESE 2 LINES
const RateLimit = require('../middleware/rateLimiter');
const adminLimiter = RateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

const router = Router();

router.use(requireAuth, requireRole('admin'));

// ALSO I ADDED adminLimiter to each route
// every route was flagged (alerts #14–19) So every route needs the limiter added
router.get('/',                    adminLimiter, getDashboard);
router.get('/users',               adminLimiter, getUsers);
router.post('/users/:id/role',     adminLimiter, postChangeRole);
router.post('/users/:id/delete',   adminLimiter, postDeleteUser);
router.post('/users/:id/ban',      adminLimiter, postBanUser);
router.post('/users/:id/unban',    adminLimiter, postUnbanUser);
router.get('/events',              adminLimiter, getAdminEvents);
router.post('/events/:id/delete',  adminLimiter, postDeleteAdminEvent);
router.get('/tickets',             adminLimiter, getTickets);

module.exports = router;