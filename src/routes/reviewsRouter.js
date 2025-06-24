const express = require('express');
const router = express.Router({ mergeParams: true });

const auth = require('../middleware/auth'); // Giả định middleware xác thực
const {
  createReview,
  getAllReviews, // Tên đã được cập nhật
  updateReview,
  deleteReview,
} = require('../controllers/reviewsController');

router.get('/', getAllReviews);


router.use(auth);

router.post('/', createReview);


router.route('/:id')
  .put(updateReview)
  .delete(deleteReview);

module.exports = router;