// src/routes/productRoutes.js
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
const upload = require('../middleware/upload');

router.get('/', getAllProducts);

router.post('/', auth, requireRoles(['Admin']), upload.array('images', 10), createProduct);

router.put('/:id', auth, requireRoles(['Admin']), upload.array('images', 10), updateProduct);

router.delete('/:id', auth, requireRoles(['Admin']), deleteProduct);

module.exports = router;