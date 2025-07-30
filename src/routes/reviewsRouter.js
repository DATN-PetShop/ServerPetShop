// src/routes/reviewRoutes.js - Updated với Upload Images
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const upload = require('../middleware/upload');
const {
  createReview,
  getAllReviews,
  getReviewById,
  getReviewsByPet,
  updateReview,
  deleteReview
} = require('../controllers/reviewController');

// ===== PUBLIC ROUTES =====
// Lấy tất cả reviews (public)
router.get('/public', getAllReviews);

// Lấy review theo ID (public)
router.get('/public/:id', getReviewById);

// Lấy reviews theo pet ID (public)
router.get('/public/pet/:petId', getReviewsByPet);

// ===== AUTHENTICATED ROUTES =====
// Lấy tất cả reviews (authenticated users)
router.get('/', auth, getAllReviews);

// Lấy review theo ID (authenticated users)
router.get('/:id', auth, getReviewById);

// Lấy reviews theo pet ID (authenticated users)
router.get('/pet/:petId', auth, getReviewsByPet);

// ===== USER ROUTES (Authenticated Users) =====
// Tạo review mới với ảnh (User only - không cho Admin)
// Giới hạn 3 ảnh cho review
router.post('/', 
  auth, 
  upload.array('images', 3), 
  createReview
);

// Cập nhật review với ảnh (User owner hoặc Admin)
router.put('/:id', 
  auth, 
  upload.array('images', 3), 
  updateReview
);

// ===== ADMIN/USER ROUTES =====
// Xóa review (Admin hoặc User owner)
router.delete('/:id', auth, deleteReview);

// ===== ADMIN ONLY ROUTES =====
// Admin có thể xem tất cả reviews với thông tin chi tiết
router.get('/admin/all', 
  auth, 
  requireRoles(['Admin']), 
  getAllReviews
);

module.exports = router;