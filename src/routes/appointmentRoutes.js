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
  getAvailableSlots,
  getNoShowStatus
} = require('../controllers/appointmentController');

// Import admin appointment controller
const {
  getAllAppointments: adminGetAllAppointments,
  updateAppointmentStatus: adminUpdateAppointmentStatus,
  getAppointmentById: adminGetAppointmentById,
  getAvailableStaff,
  getAppointmentsByDate,
  bulkUpdateAppointments,
  assignStaffToAppointment,
  unassignStaffFromAppointment,
} = require('../controllers/Admin/AdminAppointmentController');

// Import admin validation
const {
  validateUpdateStatus,
  validateGetAllAppointments,
  validateGetAvailableStaff,
  validateGetByDate,
  validateBulkUpdate,
  validateAppointmentId
} = require('../middleware/adminAppointmentValidation');

// Public routes (cần auth)
router.get('/available-slots', auth, getAvailableSlots);

// User routes
router.post('/', auth, createAppointment);
router.get('/my-appointments', auth, getUserAppointments);
router.get('/no-show-status', auth, getNoShowStatus);
router.get('/:id', auth, getAppointmentById);
router.put('/:id', auth, updateAppointment);
router.patch('/:id/cancel', auth, cancelAppointment);

// Admin/Staff routes - Thêm routes mới từ AdminAppointmentController
router.get('/admin/appointments', auth, requireRoles(['Admin', 'Staff']), validateGetAllAppointments, adminGetAllAppointments);
router.get('/admin/appointments/by-date', auth, requireRoles(['Admin', 'Staff']), validateGetByDate, getAppointmentsByDate);
router.get('/admin/appointments/available-staff', auth, requireRoles(['Admin', 'Staff']), validateGetAvailableStaff, getAvailableStaff);
router.get('/admin/appointments/:id', auth, requireRoles(['Admin', 'Staff']), validateAppointmentId, adminGetAppointmentById);
router.patch('/admin/appointments/:id/status', auth, requireRoles(['Admin', 'Staff']), validateUpdateStatus, adminUpdateAppointmentStatus);
router.patch('/admin/appointments/bulk-update', auth, requireRoles(['Admin']), validateBulkUpdate, bulkUpdateAppointments);
// Thêm routes mới
router.patch('/admin/appointments/:id/assign-staff', 
  auth, 
  requireRoles(['Admin', 'Staff']), 
  validateAppointmentId, 
  assignStaffToAppointment
);

router.patch('/admin/appointments/:id/unassign-staff', 
  auth, 
  requireRoles(['Admin', 'Staff']), 
  validateAppointmentId, 
  unassignStaffFromAppointment
);
module.exports = router;