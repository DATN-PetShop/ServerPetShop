// src/routes/appointmentRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const {
  createAppointment,
  getUserAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
  getAllAppointments,
  updateAppointmentStatus,
  getAvailableSlots
} = require('../controllers/appointmentController');

// Public routes (cần auth)
router.get('/available-slots', auth, getAvailableSlots);

// User routes
router.post('/', auth, createAppointment);
router.get('/my-appointments', auth, getUserAppointments);
router.get('/:id', auth, getAppointmentById);
router.put('/:id', auth, updateAppointment);
router.patch('/:id/cancel', auth, cancelAppointment);

// Admin/Staff routes
router.get('/admin/all', auth, requireRoles(['Admin', 'Staff']), getAllAppointments);
router.patch('/admin/:id/status', auth, requireRoles(['Admin', 'Staff']), updateAppointmentStatus);

module.exports = router;