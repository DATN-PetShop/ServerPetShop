// src/routes/productRoutes.js - SỬA THỨ TỰ ROUTE
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const upload = require('../middleware/upload');
const {
  createProduct,
  getAllProducts,
  updateProduct,
  deleteProduct,
  searchProducts,
  getFilterOptions,
  getProductById
} = require('../controllers/productController');

// ✅ QUAN TRỌNG: Đặt route cụ thể TRƯỚC route động /:id
router.get('/search', searchProducts);           // ✅ Đặt trước /:id
router.get('/filter-options', getFilterOptions); // ✅ Đặt trước /:id

// Public routes
router.get('/', getAllProducts);
router.get('/:id', getProductById);              // ✅ Đặt cuối cùng

// Admin/Staff routes
router.post('/', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), createProduct);
router.put('/:id', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), updateProduct);
router.delete('/:id', auth, requireRoles(['Admin']), deleteProduct);

module.exports = router;