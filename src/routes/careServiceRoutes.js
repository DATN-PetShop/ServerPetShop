// src/routes/careServiceRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const { validateCreateService } = require('../middleware/ppointmentValidation');

// Import existing controller
const {
  getAllServices,
  getServiceById,
  getCategories,
  getServicesByCategory
} = require('../controllers/careServiceController');

// Import Admin Controller
const {
  getAllServices: adminGetAllServices,
  getServiceDetails: adminGetServiceDetails,
  createService: adminCreateService,
  updateService: adminUpdateService,
  deleteService: adminDeleteService,
  bulkUpdateServices: adminBulkUpdateServices,
  getServiceStatistics: adminGetServiceStatistics,
  toggleServiceStatus: adminToggleServiceStatus
} = require('../controllers/Admin/CareServiceAdminController');

// Import Admin Validation
const {
  validateGetAllServices,
  validateCreateService: adminValidateCreateService,
  validateUpdateService: adminValidateUpdateService,
  validateDeleteService,
  validateGetServiceDetails,
  validateBulkUpdateServices,
  validateGetServiceStatistics,
  validateToggleServiceStatus
} = require('../middleware/adminCareServiceValidation');

// ================================================
// ============= PUBLIC ROUTES ===================
// ================================================
// Public routes (không cần auth)
router.get('/categories', getCategories);

// ================================================
// ============= USER ROUTES (GIỮ NGUYÊN) =========
// ================================================
// Routes cần auth cho user
router.get('/', auth, getAllServices);
router.get('/category/:category', auth, getServicesByCategory);
router.get('/:id', auth, getServiceById);

// ================================================
// ========= ADMIN ROUTES (THÊM MỚI) ==============
// ================================================

// ✅ Lấy tất cả dịch vụ với filters, search, pagination (Admin)
router.get('/admin/services', 
  auth, 
  requireRoles(['Admin', 'Staff']), 
  validateGetAllServices, 
  adminGetAllServices
);

// ✅ Lấy thống kê dịch vụ (Admin)
router.get('/admin/statistics', 
  auth, 
  requireRoles(['Admin', 'Staff']), 
  validateGetServiceStatistics, 
  adminGetServiceStatistics
);

// ✅ Lấy chi tiết dịch vụ với thống kê (Admin)
router.get('/admin/services/:id/details', 
  auth, 
  requireRoles(['Admin', 'Staff']), 
  validateGetServiceDetails, 
  adminGetServiceDetails
);

// ✅ Tạo dịch vụ mới (Admin/Staff)
router.post('/admin/services', 
  auth, 
  requireRoles(['Admin', 'Staff']), 
  adminValidateCreateService, 
  adminCreateService
);

// ✅ Cập nhật dịch vụ (Admin/Staff)
router.put('/admin/services/:id', 
  auth, 
  requireRoles(['Admin', 'Staff']), 
  adminValidateUpdateService, 
  adminUpdateService
);

// ✅ Toggle trạng thái active/inactive (Admin/Staff)
router.patch('/admin/services/:id/toggle-status', 
  auth, 
  requireRoles(['Admin', 'Staff']), 
  validateToggleServiceStatus, 
  adminToggleServiceStatus
);

// ✅ Bulk update services (Admin only)
router.patch('/admin/services/bulk-update', 
  auth, 
  requireRoles(['Admin']), 
  validateBulkUpdateServices, 
  adminBulkUpdateServices
);

// ✅ Xóa dịch vụ (Admin only)
router.delete('/admin/services/:id', 
  auth, 
  requireRoles(['Admin']), 
  validateDeleteService, 
  adminDeleteService
);

module.exports = router;