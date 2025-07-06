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
  getProductById // Thêm hàm mới
} = require('../controllers/productController');

// Public routes
router.get('/', getAllProducts);
router.get('/:id', getProductById); // Thêm route mới để lấy chi tiết sản phẩm

// Search and filter routes
router.get('/search', searchProducts);
router.get('/filter-options', getFilterOptions);

// Admin/Staff routes
router.post('/', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), createProduct);
router.put('/:id', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), updateProduct);
router.delete('/:id', auth, requireRoles(['Admin']), deleteProduct);

module.exports = router;