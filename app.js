require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

require('./database/db'); // Opens DB, applies schema on startup

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directories exist
const uploadDir = path.join(__dirname, 'public/uploads/events');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const qrDir = path.join(__dirname, 'public/qrcodes');
if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

const profileUploadDir = path.join(__dirname, 'public/uploads/profiles');
if (!fs.existsSync(profileUploadDir)) fs.mkdirSync(profileUploadDir, { recursive: true });

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeValid = allowedTypes.test(file.mimetype);
  if (extValid && mimeValid) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'ticketing-app-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);
app.locals.upload = upload;

const RateLimit = require('./middleware/rateLimiter');
const globalLimiter = RateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use(globalLimiter);      // CodeQL sees this, alert #13 disappears
const { authenticate } = require('./middleware/auth');
app.use(authenticate);

// Routes
const authRoutes    = require('./routes/auth');
const eventRoutes   = require('./routes/events');
const managerRoutes = require('./routes/manager');
const adminRoutes   = require('./routes/admin');
const profileRoutes = require('./routes/profile');

app.use('/',        authRoutes);
app.use('/events',  eventRoutes);
app.use('/manager', managerRoutes);
app.use('/admin',   adminRoutes);
app.use('/profile', profileRoutes);

// Home
app.get('/', (req, res) => res.render('index', { user: req.user }));

// 404 handler
app.use((req, res) => {
  res.status(404).send('<h1>404 - Page Not Found</h1>');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).send('<h1>500 - Internal Server Error</h1><p>' + err.message + '</p>');
});

app.listen(PORT, () => {
  console.log(`Ticketing app running at http://localhost:${PORT}`);
});

module.exports = app;
