// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  adminRoute,
  staffRoute,
  getAllUsers,
  getStaffUsers, 
  getCustomerUsers, 
  updateCustomerStatus,
  getUserById,
  updateUser,
  deleteUser,
  changePassword,
  banUser,   
  unbanUser 
} = require('../controllers/userController');
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');

// Rate limiter for expensive routes
const customersLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

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
router.get('/staff-only', customersLimiter, auth, requireRoles(['Admin']), getStaffUsers); 
router.get('/customers', customersLimiter, auth, requireRoles(['Admin', 'Staff']), getCustomerUsers);    
router.patch('/:id/status', auth, requireRoles(['Admin']), updateCustomerStatus); 
router.patch('/:id/ban', auth, requireRoles(['Admin', 'Staff']), banUser);           
router.patch('/:id/unban', auth, requireRoles(['Admin', 'Staff']), unbanUser);      

router.get('/:id', auth, requireRoles(['Admin', 'Staff']), getUserById);
router.put('/:id', auth, updateUser);
router.delete('/:id', auth, requireRoles(['Admin']), deleteUser);

module.exports = router;
