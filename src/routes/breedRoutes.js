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
  searchBreedsByName,
  getBreedSearchSuggestions
} = require('../controllers/breedController');

router.get('/search', searchBreedsByName);                    // Tìm kiếm breed theo tên
router.get('/search/suggestions', getBreedSearchSuggestions); // Gợi ý tìm kiếm
// ===== ADMIN/STAFF ROUTES =====
// ai cung xem dc
router.get('/',  getAllBreeds); 
router.get('/:id', getBreedById);
router.get('/category/:categoryId', getBreedsByCategory); 

// admin nhan vien 
router.post('/', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), createBreed);
router.put('/:id', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), updateBreed);
router.delete('/:id', auth, requireRoles(['Admin']), deleteBreed);
module.exports = router;