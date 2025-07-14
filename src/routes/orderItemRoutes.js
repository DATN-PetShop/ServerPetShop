// orderItemRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createOrderItem,
  getMyOrderItems,
  getOrderItemById,
  updateOrderItem,
  deleteOrderItem,
  getOrderItemsByOrderId,
  searchOrderItems // Thêm hàm mới
} = require('../controllers/orderItemsController');
const requireRole = require('../middleware/requireRole');

router.get('/', auth, getMyOrderItems);
router.get('/by-order/:orderId', auth, getOrderItemsByOrderId);
router.get('/search', auth, searchOrderItems); // Thêm tuyến đường tìm kiếm
router.post('/', auth, createOrderItem);
router.put('/:id', auth, requireRole(['Admin', 'Staff']), updateOrderItem);
router.delete('/:id', auth, requireRole(['Admin']), deleteOrderItem);

module.exports = router;