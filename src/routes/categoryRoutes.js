const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const upload = require('../middleware/upload');
const {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');

// Public routes
router.get('/',  getAllCategories); // Anyone can view categories
router.get('/:id',  getCategoryById); 

// Admin only routes - Thêm upload middleware để xử lý images
router.post('/', auth, requireRoles(['Admin']), upload.array('images', 5), createCategory);
router.put('/:id', auth, requireRoles(['Admin']), upload.array('images', 5), updateCategory);
router.delete('/:id', auth, requireRoles(['Admin']), deleteCategory);

module.exports = router;