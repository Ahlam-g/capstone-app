'use strict';

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const { requireAuth } = require('../middleware/auth');
const ctrl    = require('../controllers/profileController');
const { postCancelTicket } = require('../controllers/eventController');

const profileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) =>
      cb(null, path.join(__dirname, '../public/uploads/profiles')),
    filename: (req, file, cb) =>
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok =
      /jpeg|jpg|png|gif/.test(path.extname(file.originalname).toLowerCase()) &&
      /jpeg|jpg|png|gif/.test(file.mimetype);
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  },
});

const router = express.Router();
router.use(requireAuth);

router.get('/',         ctrl.getProfile);
router.get('/edit',     ctrl.getEditProfile);
router.post('/edit',    profileUpload.single('profile_picture'), ctrl.postEditProfile);
router.get('/password',          ctrl.getPasswordChange);
router.post('/password',         ctrl.postPasswordChange);
router.get('/tickets',             ctrl.getMyTickets);
router.get('/tickets/:id',         ctrl.getTicketDetail);
router.post('/tickets/:id/cancel', postCancelTicket);

module.exports = router;
