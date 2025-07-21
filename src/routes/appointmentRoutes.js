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
router.get('/available-slots', auth, getAvailableSlots);// Lấy các khung giờ có sẵn cho lịch hẹn

// User routes
router.post('/', auth, createAppointment);// Tạo lịch hẹn
router.get('/my-appointments', auth, getUserAppointments); // Lấy lịch hẹn của người dùng
router.get('/:id', auth, getAppointmentById);// Lấy lịch hẹn theo ID
router.put('/:id', auth, updateAppointment);// Cập nhật lịch hẹn
router.patch('/:id/cancel', auth, cancelAppointment);// Hủy lịch hẹn

// Admin/Staff routes
router.get('/admin/all', auth, requireRoles(['Admin', 'Staff']), getAllAppointments);// Lấy tất cả lịch hẹn
router.patch('/admin/:id/status', auth, requireRoles(['Admin', 'Staff']), updateAppointmentStatus);// Cập nhật trạng thái lịch hẹn

module.exports = router;