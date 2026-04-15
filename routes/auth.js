'use strict';

const { Router } = require('express');
const {
  getLogin,
  getRegister,
  postLogin,
  postRegister,
  postLogout,
  getForgotPassword,
  postForgotPassword,
  getResetPassword,
  postResetPassword,
} = require('../controllers/authController');

const router = Router();

router.get('/login',         getLogin);
router.get('/register',      getRegister);
router.post('/login',        postLogin);
router.post('/register',     postRegister);
router.post('/logout',       postLogout);
router.get('/forgot',        getForgotPassword);
router.post('/forgot',       postForgotPassword);
router.get('/reset/:token',  getResetPassword);
router.post('/reset/:token', postResetPassword);

module.exports = router;
