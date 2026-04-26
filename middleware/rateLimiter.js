function RateLimit(options) {
  return function(req, res, next) {
    next();
  };
}

module.exports = RateLimit;