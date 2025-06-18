const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createPet,
  getMyPets,
  updatePet,
  deletePet
} = require('../controllers/petController');
const requireRole = require('../middleware/requireRole');

// user guest
router.get('/', auth, getMyPets);            // lay danh sach

//admin
router.post('/', auth, requireRole(['Admin']), createPet); // them pet
router.put('/:id', auth, requireRole(['Admin', 'Staff']), updatePet); // sua pet
router.delete('/:id', auth, requireRole(['Admin']), deletePet); // xoa pet

module.exports = router;
