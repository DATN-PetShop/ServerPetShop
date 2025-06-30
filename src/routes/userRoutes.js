// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getCurrentUser,
  adminRoute,
  staffRoute,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
} = require('../controllers/userController');
const auth = require('../middleware/auth');

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// user
router.get('/me', auth, getCurrentUser);
router.get('/admin', auth, adminRoute);
router.get('/staff', auth, staffRoute);

router.get('/', auth,requireRoles(['Admin']), getAllUsers);
router.get('/:id', auth,requireRoles(['Admin']), getUserById);
router.put('/:id', auth,requireRoles(['Admin']), updateUser);
router.delete('/:id', auth,requireRoles(['Admin']), deleteUser);

module.exports = router;