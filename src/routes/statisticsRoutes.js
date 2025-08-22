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
  getDashboardProfitSummary,
  exportStatisticalReport
} = require('../controllers/Admin/statisticsController');

// Middleware: Chỉ Admin và Staff mới có thể xem thống kê
const statsAuth = [auth, requireRoles(['Admin', 'Staff'])];
// DASHBOARD TỔNG QUAN
router.get('/dashboard', statsAuth, getDashboardOverview);
// 1. THỐNG KÊ DOANH THU VÀ BÁN HÀNG
router.get('/revenue', statsAuth, getRevenueStatistics);
router.get('/top-selling', statsAuth, getTopSellingItems);
router.get('/orders/status', statsAuth, getOrderStatusStatistics);
// 2. THỐNG KÊ KHÁCH HÀNG
router.get('/customers', statsAuth, getCustomerStatistics);
// 3. THỐNG KÊ SẢN PHẨM VÀ THÚ CƯNG
router.get('/inventory', statsAuth, getInventoryStatistics);
// 4. THỐNG KÊ DỊCH VỤ
router.get('/services', statsAuth, getServiceStatistics);
// 5. THỐNG KÊ TỔNG QUAN TRÊN DASHBOARD
router.get('/profit/overview', statsAuth, getProfitOverview);
// 6. THỐNG KÊ LỢI NHUẬN
router.get('/profit/by-period', statsAuth, getProfitByPeriod);  
// Lấy thống kê lợi nhuận theo sản phẩm
router.get('/profit/by-products', statsAuth, getProfitByProducts);
// 7. THỐNG KÊ TỒN KHO HIỆN TẠI
router.get('/inventory/value', statsAuth, getCurrentInventoryValue);
// 8. THỐNG KÊ LỢI NHUẬN TRÊN DASHBOARD
router.get('/dashboard/profit', statsAuth, getDashboardProfitSummary);
// xuất báo cáo thống kê
router.get('/export-report', statsAuth, exportStatisticalReport);
module.exports = router;