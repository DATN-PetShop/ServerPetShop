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
  deleteBreed
} = require('../controllers/breedController');

// ai cung xem dc
router.get('/', auth, getAllBreeds); 
router.get('/:id', auth, getBreedById);
router.get('/category/:categoryId', auth, getBreedsByCategory); 

// admin nhan vien - Thêm upload middleware để xử lý images
router.post('/', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), createBreed);
router.put('/:id', auth, requireRoles(['Admin', 'Staff']), upload.array('images', 5), updateBreed);

// chi admin dc xoa
router.delete('/:id', auth, requireRoles(['Admin']), deleteBreed);

module.exports = router;