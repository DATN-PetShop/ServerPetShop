const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRoles = require('../middleware/requireRole');
const {
  createReview,
  getAllReviews,
  deleteReview
} = require('../controllers/reviewController');

router.get('/', getAllReviews);
router.post('/', auth, createReview);
router.delete('/:id', auth, requireRoles(['Admin']), deleteReview);

module.exports = router;