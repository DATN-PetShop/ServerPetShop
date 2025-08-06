// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  adminRoute,
  staffRoute,
  getAllUsers,
  getStaffUsers, // Import function mới
  getCustomerUsers, // Import function mới,
  updateCustomerStatus, // Import function mới
  getUserById,
  updateUser,
  deleteUser,
  changePassword,
  banUser,       // ✅ Thêm import
  unbanUser      // ✅ Thêm import
} = require('../controllers/userController');
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', auth, logoutUser);

// user
router.get('/me', auth, getCurrentUser);
router.put('/change-password', auth, changePassword);
router.get('/admin', auth, requireRoles(['Admin']), adminRoute);
router.get('/staff', auth, requireRoles(['Admin', 'Staff']), staffRoute);

router.get('/', auth, requireRoles(['Admin']), getAllUsers);
router.get('/staff-only', auth, requireRoles(['Admin']), getStaffUsers); // Route mới
router.get('/customers', auth, requireRoles(['Admin', 'Staff']), getCustomerUsers);     // ← Route mới
router.patch('/:id/status', auth, requireRoles(['Admin']), updateCustomerStatus); // ← Route mới
router.patch('/:id/ban', auth, requireRoles(['Admin']), banUser);           // ✅ Route ban user
router.patch('/:id/unban', auth, requireRoles(['Admin']), unbanUser);       // ✅ Route unban user

router.get('/:id', auth, requireRoles(['Admin', 'Staff']), getUserById);
router.put('/:id', auth, updateUser);
router.delete('/:id', auth, requireRoles(['Admin']), deleteUser);

module.exports = router;