// src/routes/statisticsRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const {
  getRevenueStatistics,
  getTopSellingItems,
  getOrderStatusStatistics,
  getCustomerStatistics,
  getInventoryStatistics,
  getServiceStatistics,
  getDashboardOverview,
  getProfitOverview,
  getProfitByPeriod,
  getProfitByProducts,
  getCurrentInventoryValue,
  getDashboardProfitSummary
} = require('../controllers/Admin/statisticsController');

// Middleware: Chỉ Admin và Staff mới có thể xem thống kê
const statsAuth = [auth, requireRoles(['Admin', 'Staff'])];

// ===============================
// DASHBOARD TỔNG QUAN
// ===============================
router.get('/dashboard', statsAuth, getDashboardOverview);

// ===============================
// 1. THỐNG KÊ DOANH THU VÀ BÁN HÀNG
// ===============================
router.get('/revenue', statsAuth, getRevenueStatistics);
router.get('/top-selling', statsAuth, getTopSellingItems);
router.get('/orders/status', statsAuth, getOrderStatusStatistics);

// ===============================
// 2. THỐNG KÊ KHÁCH HÀNG
// ===============================
router.get('/customers', statsAuth, getCustomerStatistics);

// ===============================
// 3. THỐNG KÊ SẢN PHẨM VÀ THÚ CƯNG
// ===============================
router.get('/inventory', statsAuth, getInventoryStatistics);

// =============================== 
// 4. THỐNG KÊ DỊCH VỤ
// ===============================
router.get('/services', statsAuth, getServiceStatistics);

router.get('/profit/overview', statsAuth, getProfitOverview);
router.get('/profit/by-period', statsAuth, getProfitByPeriod);  
router.get('/profit/by-products', statsAuth, getProfitByProducts);
router.get('/inventory/value', statsAuth, getCurrentInventoryValue);
router.get('/dashboard/profit', statsAuth, getDashboardProfitSummary);
module.exports = router;