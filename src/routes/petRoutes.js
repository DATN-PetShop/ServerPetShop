// src/routes/petRoutes.js - SỬA THỨ TỰ ROUTE
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const upload = require('../middleware/upload');
const {
  createPet,
  getAllPetsPublic,
  getAllPetsAdmin,
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

// ✅ QUAN TRỌNG: Đặt route cụ thể TRƯỚC route động /:id
router.get('/search', searchPets);                      // ✅ Đặt trước /:id
router.get('/search/suggestions', searchSuggestions);   // ✅ Đặt trước /:id
router.get('/filter-options', getFilterOptions);       // ✅ Đặt trước /:id
router.get('/search/category', searchPetsByCategory);   // ✅ Đặt trước /:id
router.get('/search/breed', searchPetsByBreed);         // ✅ Đặt trước /:id
router.get('/search/breed/suggestions', getBreedSearchSuggestions); // ✅ Đặt trước /:id

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
router.get('/', getAllPetsPublic);                      // ✅ Tất cả routes cụ thể ở trên
router.get('/:id', getPetById);                         // ✅ Đặt cuối cùng

// Admin routes
router.get('/admin', auth, requireRoles(['Admin']), getAllPetsAdmin);

// CRUD routes (Admin/Staff only)
router.post('/', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), createPet);
router.put('/:id', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), updatePet);
router.delete('/:id', auth, requireRoles(['Admin']), deletePet);

module.exports = router;