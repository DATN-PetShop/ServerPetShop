const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const {
  createBreed,
  getAllBreeds,
  getBreedsByCategory,
  updateBreed,
  deleteBreed
} = require('../controllers/breedController');

// ai cung xem dc
router.get('/', auth, getAllBreeds); 
router.get('/category/:categoryId', auth, getBreedsByCategory); 

// admin nhan vien
router.post('/', auth, requireRoles(['Admin', 'Staff']), createBreed);
router.put('/:id', auth, requireRoles(['Admin', 'Staff']), updateBreed);

// chi admin dc xoa
router.delete('/:id', auth, requireRoles(['Admin']), deleteBreed);

module.exports = router;