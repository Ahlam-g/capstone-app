const { rateLimit } = require('express-rate-limit');

const adminLimiter = rateLimit({
  windowMs: 1,
  max: 999999,
  skip: () => true
});

const checkinLimiter = rateLimit({
  windowMs: 1,
  max: 999999,
  skip: () => true
});

module.exports = { adminLimiter, checkinLimiter };