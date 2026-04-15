'use strict';

const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, '../public/uploads/events')),
  filename: (req, file, cb) => {
    const suffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, suffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const ok =
    /jpeg|jpg|png|gif/.test(path.extname(file.originalname).toLowerCase()) &&
    /jpeg|jpg|png|gif/.test(file.mimetype);
  cb(ok ? null : new Error('Only image files are allowed'), ok);
};

module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});
