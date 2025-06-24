const Review = require('../models/Reviews');
const BaseCrudController = require('./baseCrudController');

class ReviewController extends BaseCrudController {
  constructor() {
    super(Review, null); 
  }

 
  getEntityName() {
    return 'Review';
  }


  getRequiredFields() {
    return ['rating', 'pet_id']; 
  }


  async getAll(req, res) {
    try {
      const { petId } = req.params;
      if (!petId) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Pet ID is required in URL params',
        });
      }

      const reviews = await this.model.find({ pet_id: petId })
        .populate('user_id', 'name avatar') // Lấy tên và avatar của người viết review
        .sort({ createdAt: -1 }) // Sắp xếp review mới nhất lên đầu
        .lean();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Reviews retrieved successfully',
        data: reviews,
      });
    } catch (error) {
      console.error('Get all reviews error:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Internal server error',
      });
    }
  }


}


const reviewController = new ReviewController();

module.exports = {
  createReview: reviewController.create.bind(reviewController),
  getAllReviews: reviewController.getAll.bind(reviewController), // Đổi tên để rõ nghĩa hơn
  updateReview: reviewController.update.bind(reviewController),
  deleteReview: reviewController.delete.bind(reviewController),
};