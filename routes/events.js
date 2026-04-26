'use strict';

const { Router } = require('express');
const { getEvents, getEventDetail, postReserve } = require('../controllers/eventController');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.get('/',           getEvents);
router.get('/:id',        getEventDetail);
router.post('/:id/reserve', requireAuth, postReserve);

module.exports = router;
