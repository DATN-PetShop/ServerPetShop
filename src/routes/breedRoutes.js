// src/routes/breedRoutes.js - Enhanced version
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const upload = require('../middleware/upload');
const {
  createBreed,
  getAllBreeds,
  getBreedById,
  getBreedsByCategory,
  updateBreed,
  deleteBreed,
} = require('../controllers/breedController');

// ===== PUBLIC ROUTES =====
// Lấy tất cả breeds (public, cho user app)
router.get('/public', getAllBreeds);

// Lấy breeds theo category (public)
router.get('/public/category/:categoryId', getBreedsByCategory);

// Lấy breed theo ID (public)
router.get('/public/:id', getBreedById);

// ===== AUTHENTICATED ROUTES =====
// Lấy tất cả breeds (authenticated users)
// router.get('/', auth, getAllBreeds);
router.get('/', getAllBreeds); 
// Lấy breed theo ID (authenticated users)
router.get('/:id', auth, getBreedById);

// Lấy breeds theo category (authenticated users)
router.get('/category/:categoryId', auth, getBreedsByCategory);

// ===== ADMIN/STAFF ROUTES =====
// Tạo breed mới (Admin/Staff only)
router.post('/', auth, requireRoles(['Admin', 'Staff']), createBreed);

// Cập nhật breed (Admin/Staff only)
router.put('/:id', auth, requireRoles(['Admin', 'Staff']), updateBreed);

// ai cung xem dc
router.get('/', auth, getAllBreeds); 
router.get('/:id', auth, getBreedById);
router.get('/category/:categoryId', auth, getBreedsByCategory); 

// admin nhan vien - Thêm upload middleware để xử lý images
router.post('/', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), createBreed);
router.put('/:id', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), updateBreed);

// ===== ADMIN ONLY ROUTES =====
// Xóa breed (Admin only)
router.delete('/:id', auth, requireRoles(['Admin']), deleteBreed);

module.exports = router;