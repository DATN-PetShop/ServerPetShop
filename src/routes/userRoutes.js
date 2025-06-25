// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getCurrentUser,
  adminRoute,
  staffRoute
} = require('../controllers/userController');
const auth = require('../middleware/auth');

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// user
router.get('/me', auth, getCurrentUser);
router.get('/admin', auth, adminRoute);
router.get('/staff', auth, staffRoute);


module.exports = router;