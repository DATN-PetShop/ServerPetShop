// src/routes/careServiceRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const { validateCreateService } = require('../middleware/ppointmentValidation');
const {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
  getCategories,
  getServicesByCategory
} = require('../controllers/careServiceController');

// Public routes (không cần auth)
router.get('/categories', getCategories);

// Routes cần auth
router.get('/', auth, getAllServices);
router.get('/category/:category', auth, getServicesByCategory);
router.get('/:id', auth, getServiceById);

// Admin/Staff routes
router.post('/', auth, requireRoles(['Admin', 'Staff']), validateCreateService, createService);
router.put('/:id', auth, requireRoles(['Admin', 'Staff']), updateService);

// Admin only routes
router.delete('/:id', auth, requireRoles(['Admin']), deleteService);

module.exports = router;