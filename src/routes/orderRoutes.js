const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  saveVnpayOrder
} = require('../controllers/orderController');

// ✅ THÊM MỚI: Import Admin Controller Functions
const {
  getAllOrders,
  updateOrderStatus,
  getOrderDetails,
  getOrderStatistics,
  getOrderByIdAdmin,
  updateOrderAdmin,
  deleteOrderAdmin
} = require('../controllers/Admin/orderAdminController');

const requireRole = require('../middleware/requireRole');

// ================================================
// ============= USER ROUTES (GIỮ NGUYÊN) =========
// ================================================
router.get('/', auth, getMyOrders); // Get list of user's orders
router.get('/:id', auth, getOrderById); // Get single order by ID

router.post('/', auth, createOrder); // Create new order
router.put('/:id', auth, requireRole(['Admin', 'Staff']), updateOrder); // Update order
router.delete('/:id', auth, requireRole(['Admin']), deleteOrder); // Delete order
router.post('/vnpay', saveVnpayOrder);

// ================================================
// ========= THÊM MỚI: ADMIN ROUTES ===============
// ================================================

// ✅ Lấy tất cả đơn hàng với filters, search, pagination
router.get('/admin/all', auth, requireRole(['Admin', 'Staff']), getAllOrders);
// ✅ Lấy thống kê đơn hàng
router.get('/admin/statistics', auth, requireRole(['Admin', 'Staff']), getOrderStatistics);
// ✅ Lấy chi tiết đơn hàng với order items
router.get('/admin/:id/details', auth, requireRole(['Admin', 'Staff']), getOrderDetails);
// ✅ Lấy đơn hàng theo ID (admin có thể xem mọi đơn hàng)
router.get('/admin/:id', auth, requireRole(['Admin', 'Staff']), getOrderByIdAdmin);
// ✅ Cập nhật trạng thái đơn hàng
router.patch('/admin/:id/status', auth, requireRole(['Admin', 'Staff']), updateOrderStatus);
// ✅ Cập nhật đơn hàng (admin có thể sửa mọi đơn hàng)
router.put('/admin/:id', auth, requireRole(['Admin', 'Staff']), updateOrderAdmin);
// ✅ Xóa đơn hàng (chỉ Admin, không phải Staff)
router.delete('/admin/:id', auth, requireRole(['Admin']), deleteOrderAdmin);

module.exports = router;