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

const router = Router();

// All manager routes require authentication and manager (or admin) role
router.use(requireAuth, requireRole('manager'));

router.get('/',                    getDashboard);
router.get('/events/new',          getNewEvent);
router.post('/events',             upload.single('image'), postCreateEvent);
router.get('/events/:id/edit',     getEditEvent);
router.post('/events/:id',         upload.single('image'), postUpdateEvent);
router.post('/events/:id/delete',  postDeleteEvent);
router.get('/checkin',             getCheckin);
router.post('/checkin',            postCheckin);

module.exports = router;
