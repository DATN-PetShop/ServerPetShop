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
  deletePet
} = require('../controllers/petController');

router.get('/', getAllPetsPublic); // all role có thể xem

// xem alll thong tin 
router.get('/admin', auth, requireRoles(['Admin']), getAllPetsAdmin); 

router.post('/', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), createPet);
router.put('/:id', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), updatePet);
router.delete('/:id', auth, requireRoles(['Admin']), deletePet);


// tim kiếm thú 
// router.get('/search', searchPets);

// // Lấy gợi ý tìm kiếm (public)
// router.get('/search/suggestions', searchSuggestions);

// // Lấy các options cho filter (public)
// router.get('/filter-options', getFilterOptions);

module.exports = router;