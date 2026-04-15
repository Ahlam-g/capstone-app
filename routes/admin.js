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

const router = Router();

// All admin routes require authentication and admin role
router.use(requireAuth, requireRole('admin'));

router.get('/',                    getDashboard);
router.get('/users',               getUsers);
router.post('/users/:id/role',     postChangeRole);
router.post('/users/:id/delete',   postDeleteUser);
router.post('/users/:id/ban',      postBanUser);
router.post('/users/:id/unban',    postUnbanUser);
router.get('/events',              getAdminEvents);
router.post('/events/:id/delete',  postDeleteAdminEvent);
router.get('/tickets',             getTickets);

module.exports = router;
