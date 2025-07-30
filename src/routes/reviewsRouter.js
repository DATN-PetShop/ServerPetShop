// src/routes/reviewRoutes.js - Enhanced với các endpoint mới
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
  getMyReviews,
  updateReview,
  deleteReview,
  hideReviewsForRatedProduct
} = require('../controllers/reviewController');

// ===== PUBLIC ROUTES =====
// Lấy tất cả reviews (public)
router.get('/public', getAllReviews);

// Lấy review theo ID (public)
router.get('/public/:id', getReviewById);

// Lấy reviews theo pet ID với phân trang và sắp xếp (public)
// Params: ?page=1&limit=10&sortBy=created_at&sortOrder=desc&rating=5
router.get('/public/pet/:petId', getReviewsByPet);

// ===== AUTHENTICATED ROUTES =====
// Lấy tất cả reviews (authenticated users)
router.get('/', auth, getAllReviews);

// Lấy review theo ID (authenticated users)
router.get('/:id', auth, getReviewById);

// Lấy reviews theo pet ID với phân trang và sắp xếp (authenticated users)
router.get('/pet/:petId', auth, getReviewsByPet);

// Lấy đánh giá của user hiện tại
// Params: ?page=1&limit=10&sortBy=created_at&sortOrder=desc
router.get('/my/reviews', auth, getMyReviews);

// ===== USER ROUTES (Authenticated Users) =====
// Tạo review mới với ảnh (User only - không cho Admin)
// Giới hạn 3 ảnh cho review
router.post('/', 
  auth, 
  upload.array('images', 3), 
  createReview
);

// Cập nhật review với ảnh (User owner hoặc Admin)
// CHỈ CHO PHÉP TRONG 7 NGÀY SAU KHI TẠO (trừ Admin)
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

// Ẩn tất cả đánh giá của một sản phẩm khi sản phẩm đã được đánh giá (Admin only)
router.patch('/admin/hide/:petId', 
  auth, 
  requireRoles(['Admin']), 
  hideReviewsForRatedProduct
);

module.exports = router;