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
  getFilterOptions
} = require('../controllers/petController');

// search
router.get('/search', searchPets);
router.get('/search/suggestions', searchSuggestions);
router.get('/filter-options', getFilterOptions);

//filter
router.get('/breed/:breedId', getPetsByBreed);
router.get('/breed/:breedId/statistics', getBreedStatistics);
router.get('/category/:categoryId', getPetsByCategory);

// Public routes
router.get('/', getAllPetsPublic); // all role có thể xem

// Admin routes
router.get('/admin', auth, requireRoles(['Admin']), getAllPetsAdmin); 

// CRUD routes (Admin/Staff only)
router.post('/', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), createPet);
router.put('/:id', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), updatePet);
router.delete('/:id', auth, requireRoles(['Admin']), deletePet);

module.exports = router;