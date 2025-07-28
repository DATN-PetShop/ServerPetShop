// ServerPetShop/src/routes/petRoutes.js - Updated version để phù hợp với code hiện tại
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const upload = require('../middleware/upload');

// Import existing pet controller (giữ nguyên)
const {
  createPet,
  getAllPetsPublic,
  getAllPetsAdmin, // Sử dụng method này từ petController hiện tại
  updatePet,
  deletePet,
  searchPets,
  searchSuggestions,
  getFilterOptions,
  getPetsByBreed,
  getPetsByCategory,
  getBreedStatistics,
  searchPetsByCategory,
  getTrendingCategories,
  compareCategories,
  getCategoryInsights,
  searchPetsByBreed,
  getSimilarBreeds,
  getBreedPopularityRanking,
  compareBreedPrices,
  getBreedSearchSuggestions,
  getPetById
} = require('../controllers/petController');

// ==========================================
// ========== PUBLIC ROUTES ================
// ==========================================
// ✅ QUAN TRỌNG: Đặt route cụ thể TRƯỚC route động /:id
router.get('/search', searchPets);                      
router.get('/search/suggestions', searchSuggestions);   
router.get('/filter-options', getFilterOptions);       
router.get('/search/category', searchPetsByCategory);   
router.get('/search/breed', searchPetsByBreed);         
router.get('/search/breed/suggestions', getBreedSearchSuggestions); 

// Trending và insights routes
router.get('/trending/categories', getTrendingCategories);
router.post('/categories/compare', compareCategories);
router.get('/category/:categoryId/insights', getCategoryInsights);

// Filter routes
router.get('/breed/:breedId', getPetsByBreed);
router.get('/breed/:breedId/statistics', getBreedStatistics);
router.get('/breed/:breedId/similar', getSimilarBreeds);
router.get('/breeds/popularity', getBreedPopularityRanking);
router.post('/breeds/compare-prices', compareBreedPrices);
router.get('/category/:categoryId', getPetsByCategory);

// Public routes
router.get('/', getAllPetsPublic);                      
router.get('/:id', getPetById);                         

// ==========================================
// =========== ADMIN ROUTES ================
// ==========================================

// ✅ Sử dụng getAllPetsAdmin method có sẵn
router.get('/admin', auth, requireRoles(['Admin', 'Staff']), getAllPetsAdmin);

// ==========================================
// =========== CRUD ROUTES =================
// ==========================================

// CRUD routes - TEMP: Bỏ authentication để test
router.post('/', upload.array('images', 5), createPet);
router.put('/:id', upload.array('images', 5), updatePet);
router.delete('/:id', deletePet);

// Sau khi test xong, restore lại:
// router.post('/', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), createPet);
// router.put('/:id', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), updatePet);
// router.delete('/:id', auth, requireRoles(['Admin']), deletePet);

module.exports = router;