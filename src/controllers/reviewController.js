const Review = require('../models/Review');
const BaseCrudController = require('./baseCrudController');

class ReviewController extends BaseCrudController {
  constructor() {
    super(Review);
  }

  getRequiredFields() {
    return ['rating', 'comment', 'pet_id'];
  }

  getEntityName() {
    return 'Review';
  }

  // Tạo đánh giá
  async create(req, res) {
    try {
      console.log('REQ.BODY:', req.body);
      console.log('REQ.USER:', req.user);

      // Cấm Admin tạo đánh giá
      if (req.user && req.user.role === 'Admin') {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: 'Admin không có quyền tạo đánh giá',
          data: null
        });
      }

      const body = req.body;
      const requiredFields = this.getRequiredFields();
      const missingFields = requiredFields.filter(field => !body[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: `${missingFields.join(', ')} is required`,
          data: null
        });
      }

      const reviewData = {
        ...body,
        user_id: req.user?.id || body.user_id
      };

      const review = new this.model(reviewData);
      await review.save();

      console.log("REVIEW SAVED:", review);

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Tạo đánh giá thành công',
        data: review
      });
    } catch (error) {
      console.error('Lỗi khi tạo đánh giá:', error);
      res.status(400).json({
        success: false,
        statusCode: 400,
        message: error.message || 'Lỗi khi tạo đánh giá',
        data: null
      });
    }
  }

  // Lấy tất cả đánh giá
  async getAllReviews(req, res) {
    try {
      const reviews = await this.model.find()
        .populate('pet_id', 'name breed')
        .populate('user_id', 'username email')
        .populate('product_id', 'name price')
        .lean();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Tất cả các đánh giá đã được lấy thành công',
        data: reviews
      });
    } catch (error) {
      console.error('Lỗi khi lấy tất cả đánh giá:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi máy chủ nội bộ',
        data: null
      });
    }
  }

  // Xóa đánh giá
  async delete(req, res) {
    try {
      const review = await this.model.findByIdAndDelete(req.params.id);

      if (!review) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Không tìm thấy đánh giá',
          data: null
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Xóa đánh giá thành công',
        data: review
      });
    } catch (error) {
      console.error('Lỗi khi xóa đánh giá:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi khi xóa đánh giá',
        data: null
      });
    }
  }
}

const reviewController = new ReviewController();

module.exports = {
  createReview: reviewController.create.bind(reviewController),
  getAllReviews: reviewController.getAllReviews.bind(reviewController),
  deleteReview: reviewController.delete.bind(reviewController)
};
