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
  getPetById // New function
} = require('../controllers/petController');

// Search
router.get('/search', searchPets);
router.get('/search/suggestions', searchSuggestions);
router.get('/filter-options', getFilterOptions);

// Search by category
router.get('/search/category', searchPetsByCategory);      
router.get('/trending/categories', getTrendingCategories);     
router.post('/categories/compare', compareCategories);       
router.get('/category/:categoryId/insights', getCategoryInsights); 

// Filter
router.get('/breed/:breedId', getPetsByBreed);
router.get('/breed/:breedId/statistics', getBreedStatistics);
router.get('/category/:categoryId', getPetsByCategory);

router.get('/search/breed', searchPetsByBreed);               
router.get('/search/breed/suggestions', getBreedSearchSuggestions); 
router.get('/breed/:breedId/similar', getSimilarBreeds);     
router.get('/breeds/popularity', getBreedPopularityRanking); 
router.post('/breeds/compare-prices', compareBreedPrices);  
router.get('/search', searchPets);
router.get('/search/suggestions', searchSuggestions);
router.get('/filter-options', getFilterOptions);

// Public routes
router.get('/', getAllPetsPublic); // All roles can view
router.get('/:id', getPetById); // New endpoint to get a single pet

// Admin routes
router.get('/admin', auth, requireRoles(['Admin']), getAllPetsAdmin); 

// CRUD routes (Admin/Staff only)
router.post('/', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), createPet);
router.put('/:id', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), updatePet);
router.delete('/:id', auth, requireRoles(['Admin']), deletePet);

module.exports = router;