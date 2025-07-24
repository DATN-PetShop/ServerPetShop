// src/routes/petVariantRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const {
  createVariant,
  getVariantsByPetId,
  getVariantsWithFilter,
  getVariantById,
  updateVariant,
  deleteVariant,
  getVariantOptions
} = require('../controllers/petVariantController');

// ================================
// PUBLIC ROUTES (không cần auth)
// ================================

// Lấy tất cả biến thể của một pet (cho customer xem)
router.get('/pet/:petId', getVariantsByPetId);

// Lấy biến thể với filter
router.get('/pet/:petId/filter', getVariantsWithFilter);

// Lấy options để tạo filter dropdown (colors, genders, age/weight ranges)
router.get('/pet/:petId/options', getVariantOptions);

// Lấy thông tin chi tiết một biến thể cụ thể
router.get('/:variantId', getVariantById);

// ================================
// PROTECTED ROUTES (Admin/Staff only)
// ================================

// Tạo biến thể mới cho pet
router.post('/', auth, requireRoles(['Admin', 'Staff']), createVariant);

// Cập nhật biến thể
router.put('/:variantId', auth, requireRoles(['Admin', 'Staff']), updateVariant);

// Xóa biến thể (soft delete)
router.delete('/:variantId', auth, requireRoles(['Admin', 'Staff']), deleteVariant);

module.exports = router;