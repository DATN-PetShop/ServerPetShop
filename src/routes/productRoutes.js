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
  getProductById,
  getRelatedItems,
  getAllProductsAdmin
} = require('../controllers/productController');

// ✅ QUAN TRỌNG: Đặt route cụ thể TRƯỚC route động /:id
router.get('/search', searchProducts);           // ✅ Đặt trước /:id
router.get('/filter-options', getFilterOptions); // ✅ Đặt trước /:id

// ✅ ADMIN ROUTES - Đặt trước public routes để tránh conflict
router.get('/admin', auth, requireRoles(['Admin', 'Staff']), getAllProductsAdmin);
router.post('/admin', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), createProduct);
router.put('/admin/:id', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), updateProduct); // ✅ SỬA: thêm /
router.delete('/admin/:id', auth, requireRoles(['Admin', 'Staff']), deleteProduct); // ✅ SỬA: thêm /

// ✅ RELATED ITEMS - Đặt trước /:id
router.get('/:id/related', getRelatedItems);
router.get('/', getAllProducts);

// ✅ PUBLIC ROUTES - Đặt cuối cùng
router.get('/:id', getProductById);              // ✅ Đặt cuối cùng

module.exports = router;