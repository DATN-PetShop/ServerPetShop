const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');

// Public routes
router.get('/', auth, getAllCategories); // Anyone can view categories

// Admin only routes
router.post('/', auth, requireRoles(['Admin']), createCategory);
router.put('/:id', auth, requireRoles(['Admin']), updateCategory);
router.delete('/:id', auth, requireRoles(['Admin']), deleteCategory);

module.exports = router;