'use strict';

const { Router } = require('express');
const {
  getDashboard,
  getNewEvent,
  postCreateEvent,
  getEditEvent,
  postUpdateEvent,
  postDeleteEvent,
  getCheckin,
  postCheckin,
} = require('../controllers/managerController');
const { requireAuth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

//I ADDEED THESE 2 LINES
const RateLimit = require('../middleware/rateLimiter');
const checkinLimiter = RateLimit({ windowMs: 60 * 1000, max: 50 });

const router = Router();

router.use(requireAuth, requireRole('manager'));

router.get('/',                    getDashboard);
router.get('/events/new',          getNewEvent);
router.post('/events',             upload.single('image'), postCreateEvent);
router.get('/events/:id/edit',     getEditEvent);
router.post('/events/:id',         upload.single('image'), postUpdateEvent);
router.post('/events/:id/delete',  postDeleteEvent);
router.get('/checkin',             getCheckin);
// ONLY THIS ROUTE GETS THE LIMITER (alert #20 was only on /checkin POST)
router.post('/checkin',            checkinLimiter, postCheckin);

module.exports = router;