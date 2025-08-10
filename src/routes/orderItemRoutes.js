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
   getMyOrderItemsWithReviewStatus, 
  checkOrderItemReviewStatus, 
  searchOrderItems
} = require('../controllers/orderItemsController');
const requireRole = require('../middleware/requireRole');

router.get('/search', auth, searchOrderItems);
// ✅ Lấy danh sách order items với thông tin review status (version mới)
router.get('/with-review-status', auth, getMyOrderItemsWithReviewStatus);
// ✅ Kiểm tra trạng thái đánh giá của một order item cụ thể
router.get('/:id/review-status', auth, checkOrderItemReviewStatus);
router.get('/', auth, getMyOrderItems);
router.get('/by-order/:orderId', auth, getOrderItemsByOrderId);
router.post('/', auth, createOrderItem);
router.put('/:id', auth, requireRole(['Admin', 'Staff']), updateOrderItem);
router.delete('/:id', auth, requireRole(['Admin']), deleteOrderItem);
router.get('/:id', auth, getOrderItemById);

module.exports = router;