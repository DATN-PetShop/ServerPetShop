// src/routes/favouriteRoutes.js - CẬP NHẬT
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  addFavourite,
  removeFavourite,
  getFavourites,
  checkFavourite,
} = require('../controllers/favouriteController');

// Routes
router.post('/', auth, addFavourite);
router.delete('/', auth, removeFavourite);
router.get('/', auth, getFavourites);
router.get('/check', auth, checkFavourite); // Route mới để check

module.exports = router;
