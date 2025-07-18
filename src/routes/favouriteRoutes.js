const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const {
  createFavourite,
  getAllFavourites,
  getFavouriteById,
  updateFavourite,
  deleteFavourite
} = require('../controllers/favouriteController');

// Public routes
router.get('/', getAllFavourites);
router.get('/:id', getFavouriteById);

// Protected routes
router.post('/', auth, createFavourite);
router.put('/:id', auth, updateFavourite);
router.delete('/:id', auth, deleteFavourite);

module.exports = router;