// src/routes/cartRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartCount
} = require('../controllers/CartController'); 

// Thêm item vào giỏ hàng
router.post('/', auth, addToCart);

// Lấy giỏ hàng của user hiện tại
router.get('/', auth, getCart);

// Lấy số lượng items trong giỏ hàng
router.get('/count', auth, getCartCount);

// Cập nhật số lượng item trong giỏ hàng
router.put('/:id', auth, updateCartItem);

// Xóa item khỏi giỏ hàng
router.delete('/:id', auth, removeFromCart);

// Xóa toàn bộ giỏ hàng
router.delete('/', auth, clearCart);

module.exports = router;