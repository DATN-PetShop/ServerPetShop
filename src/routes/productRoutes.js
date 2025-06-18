const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const {
  createProduct,
  getAllProducts,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');

// lay products
router.get('/', getAllProducts);

// them sua xoa product
router.post('/', auth, requireRoles(['Admin']), createProduct);
router.put('/:id', auth, requireRoles(['Admin']), updateProduct);
router.delete('/:id', auth, requireRoles(['Admin']), deleteProduct);

module.exports = router;
