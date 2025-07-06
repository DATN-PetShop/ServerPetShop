const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  addFavourite,
  removeFavourite,
  getFavourites,
} = require('../controllers/favouriteController');

router.post('/', auth, addFavourite);
router.delete('/', auth, removeFavourite);
router.get('/', auth, getFavourites);

module.exports = router; // ✅ xuất đúng dạng middleware
