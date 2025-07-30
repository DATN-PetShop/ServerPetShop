// src/controllers/reviewController.js - Enhanced với các chức năng mới
const Review = require('../models/Review');
const ReviewImage = require('../models/ReviewImage');
const BaseCrudController = require('./baseCrudController');
const { cloudinary } = require('../config/cloudinaryConfig');

class ReviewController extends BaseCrudController {
  constructor() {
    super(Review, ReviewImage);
  }

  getRequiredFields() {
    return ['rating', 'comment', 'pet_id'];
  }

  getEntityName() {
    return 'Review';
  }

  getImageForeignKey() {
    return 'review_id';
  }

  // Tạo đánh giá với ảnh
  async create(req, res) {
    try {
      console.log('REQ.BODY:', req.body);
      console.log('REQ.USER:', req.user);
      console.log('REQ.FILES:', req.files);

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

      // Tạo review data
      const reviewData = {
        ...body,
        user_id: req.user?.id || body.user_id
      };

      // Tạo review
      const review = new this.model(reviewData);
      const savedReview = await review.save();

      // Xử lý upload ảnh nếu có
      if (this.imageModel && req.files && req.files.length > 0) {
        const imageDocs = req.files.map((file, index) => ({
          url: file.path, // Cloudinary URL
          is_primary: index === 0, // Ảnh đầu tiên là ảnh chính
          [this.getImageForeignKey()]: savedReview._id
        }));
        
        await this.imageModel.insertMany(imageDocs);
        
        // Gắn ảnh vào response
        const images = await this.imageModel.find({ 
          [this.getImageForeignKey()]: savedReview._id 
        }).lean();
        savedReview.images = images;
      }

      console.log("REVIEW SAVED:", savedReview);

      res.status(201).json({
        success: true,
        statusCode: 201,
        message: 'Tạo đánh giá thành công',
        data: savedReview
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

  // Cập nhật đánh giá với ảnh - CHỈ CHO PHÉP TRONG 7 NGÀY
  async update(req, res) {
    try {
      console.log('REQ.BODY:', req.body);
      console.log('REQ.FILES:', req.files);

      // Kiểm tra quyền - chỉ user tạo review hoặc Admin mới được update
      const existingReview = await this.model.findById(req.params.id);
      if (!existingReview) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Không tìm thấy đánh giá',
          data: null
        });
      }

      // Kiểm tra quyền sở hữu (trừ Admin)
      if (req.user.role !== 'Admin' && existingReview.user_id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: 'Bạn không có quyền chỉnh sửa đánh giá này',
          data: null
        });
      }

      // KIỂM TRA THỜI GIAN CHỈNH SỬA (7 NGÀY) - CHỈ ÁP DỤNG CHO USER
      if (req.user.role !== 'Admin') {
        const createdAt = new Date(existingReview.created_at);
        const now = new Date();
        const daysDifference = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
        
        if (daysDifference > 7) {
          return res.status(403).json({
            success: false,
            statusCode: 403,
            message: 'Bạn chỉ có thể chỉnh sửa đánh giá trong vòng 7 ngày sau khi tạo',
            data: null
          });
        }
      }

      // Cập nhật review
      const updated = await this.model.findOneAndUpdate(
        { _id: req.params.id },
        req.body,
        { new: true }
      );

      // Xử lý cập nhật ảnh nếu có
      if (this.imageModel && req.files && req.files.length > 0) {
        // Xóa ảnh cũ
        const oldImages = await this.imageModel.find({ 
          [this.getImageForeignKey()]: updated._id 
        });
        
        if (oldImages.length > 0) {
          // Xóa từ Cloudinary
          for (const image of oldImages) {
            const publicId = image.url.split('/').pop().split('.')[0];
            try {
              await cloudinary.uploader.destroy(`e-commerce/${publicId}`);
            } catch (cloudinaryError) {
              console.log('Error deleting from cloudinary:', cloudinaryError);
            }
          }
        }

        // Xóa records ảnh cũ
        await this.imageModel.deleteMany({ 
          [this.getImageForeignKey()]: updated._id 
        });

        // Tạo records ảnh mới
        const imageDocs = req.files.map((file, index) => ({
          url: file.path, // Cloudinary URL
          is_primary: index === 0, // Ảnh đầu tiên là ảnh chính
          [this.getImageForeignKey()]: updated._id
        }));
        
        await this.imageModel.insertMany(imageDocs);
      }

      // Gắn ảnh vào response
      if (this.imageModel) {
        const images = await this.imageModel.find({ 
          [this.getImageForeignKey()]: updated._id 
        }).lean();
        updated.images = images;
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Cập nhật đánh giá thành công',
        data: updated
      });
    } catch (error) {
      console.error('Lỗi khi cập nhật đánh giá:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi khi cập nhật đánh giá',
        data: null
      });
    }
  }

  // Lấy tất cả đánh giá với ảnh
  async getAllReviews(req, res) {
    try {
      const reviews = await this.model.find()
        .populate('pet_id', 'name breed')
        .populate('user_id', 'username email')
        .populate('product_id', 'name price')
        .sort({ created_at: -1 }) // Sắp xếp theo thời gian mới nhất
        .lean();

      // Thêm ảnh cho mỗi review
      if (this.imageModel) {
        for (let review of reviews) {
          const images = await this.imageModel.find({ 
            [this.getImageForeignKey()]: review._id 
          }).lean();
          review.images = images;
          
          // Thêm thông tin thời gian để kiểm tra có thể chỉnh sửa không
          const createdAt = new Date(review.created_at);
          const now = new Date();
          const daysDifference = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
          review.canEdit = daysDifference <= 7;
        }
      }

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
        message: 'Lỗi máy chứa nội bộ',
        data: null
      });
    }
  }

  // Lấy đánh giá theo ID với ảnh
  async getById(req, res) {
    try {
      const review = await this.model.findById(req.params.id)
        .populate('pet_id', 'name breed')
        .populate('user_id', 'username email')
        .populate('product_id', 'name price')
        .lean();

      if (!review) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Không tìm thấy đánh giá',
          data: null
        });
      }

      // Gắn ảnh
      if (this.imageModel) {
        const images = await this.imageModel.find({ 
          [this.getImageForeignKey()]: review._id 
        }).lean();
        review.images = images;
        
        // Thêm thông tin thời gian để kiểm tra có thể chỉnh sửa không
        const createdAt = new Date(review.created_at);
        const now = new Date();
        const daysDifference = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
        review.canEdit = daysDifference <= 7;
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Lấy đánh giá thành công',
        data: review
      });
    } catch (error) {
      console.error('Lỗi khi lấy đánh giá theo ID:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi máy chủ nội bộ',
        data: null
      });
    }
  }

  // Lấy đánh giá theo Pet ID với sắp xếp và phân trang
  async getReviewsByPet(req, res) {
    try {
      const { petId } = req.params;
      const { 
        page = 1, 
        limit = 10, 
        sortBy = 'created_at', 
        sortOrder = 'desc',
        rating // Filter theo rating
      } = req.query;

      // Build query
      let query = { pet_id: petId };
      if (rating) {
        query.rating = parseInt(rating);
      }

      // Build sort object
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const reviews = await this.model.find(query)
        .populate('user_id', 'username email avatar_url')
        .populate('product_id', 'name price')
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Tổng số reviews
      const total = await this.model.countDocuments(query);

      // Thêm ảnh cho mỗi review
      if (this.imageModel) {
        for (let review of reviews) {
          const images = await this.imageModel.find({ 
            [this.getImageForeignKey()]: review._id 
          }).lean();
          review.images = images;
          
          // Thêm thông tin thời gian để kiểm tra có thể chỉnh sửa không
          const createdAt = new Date(review.created_at);
          const now = new Date();
          const daysDifference = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
          review.canEdit = daysDifference <= 7;
        }
      }

      // Tính thống kê rating
      const ratingStats = await this.model.aggregate([
        { $match: { pet_id: petId } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
            ratingDistribution: {
              $push: '$rating'
            }
          }
        }
      ]);

      // Tính phân bố rating
      let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      if (ratingStats.length > 0) {
        ratingStats[0].ratingDistribution.forEach(rating => {
          ratingDistribution[rating]++;
        });
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Lấy đánh giá theo pet thành công',
        data: {
          reviews,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalCount: total,
            hasNextPage: page < Math.ceil(total / parseInt(limit)),
            hasPrevPage: page > 1,
            limit: parseInt(limit)
          },
          stats: {
            averageRating: ratingStats.length > 0 ? ratingStats[0].averageRating : 0,
            totalReviews: ratingStats.length > 0 ? ratingStats[0].totalReviews : 0,
            ratingDistribution
          }
        }
      });
    } catch (error) {
      console.error('Lỗi khi lấy đánh giá theo pet:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi máy chủ nội bộ',
        data: null
      });
    }
  }

  // Lấy đánh giá của user hiện tại
  async getMyReviews(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        sortBy = 'created_at', 
        sortOrder = 'desc' 
      } = req.query;

      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const reviews = await this.model.find({ user_id: req.user.id })
        .populate('pet_id', 'name breed images')
        .populate('product_id', 'name price images')
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const total = await this.model.countDocuments({ user_id: req.user.id });

      // Thêm ảnh cho mỗi review
      if (this.imageModel) {
        for (let review of reviews) {
          const images = await this.imageModel.find({ 
            [this.getImageForeignKey()]: review._id 
          }).lean();
          review.images = images;
          
          // Thêm thông tin thời gian để kiểm tra có thể chỉnh sửa không
          const createdAt = new Date(review.created_at);
          const now = new Date();
          const daysDifference = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
          review.canEdit = daysDifference <= 7;
        }
      }

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Lấy đánh giá của tôi thành công',
        data: {
          reviews,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalCount: total,
            hasNextPage: page < Math.ceil(total / parseInt(limit)),
            hasPrevPage: page > 1,
            limit: parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Lỗi khi lấy đánh giá của tôi:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi máy chủ nội bộ',
        data: null
      });
    }
  }

  // Ẩn đánh giá khi sản phẩm đã được đánh giá (Admin only)
  async hideReviewsForRatedProduct(req, res) {
    try {
      const { petId } = req.params;
      
      // Chỉ Admin mới có quyền ẩn đánh giá
      if (req.user.role !== 'Admin') {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: 'Chỉ Admin mới có quyền thực hiện chức năng này',
          data: null
        });
      }

      // Cập nhật tất cả reviews của pet này thành hidden
      const result = await this.model.updateMany(
        { pet_id: petId },
        { $set: { is_hidden: true } }
      );

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: `Đã ẩn ${result.modifiedCount} đánh giá cho sản phẩm này`,
        data: { modifiedCount: result.modifiedCount }
      });
    } catch (error) {
      console.error('Lỗi khi ẩn đánh giá:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi máy chủ nội bộ',
        data: null
      });
    }
  }

  // Xóa đánh giá và ảnh liên quan
  async delete(req, res) {
    try {
      const review = await this.model.findById(req.params.id);

      if (!review) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Không tìm thấy đánh giá',
          data: null
        });
      }

      // Kiểm tra quyền - chỉ user tạo review hoặc Admin mới được xóa
      if (req.user.role !== 'Admin' && review.user_id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: 'Bạn không có quyền xóa đánh giá này',
          data: null
        });
      }

      // Xóa ảnh liên quan
      if (this.imageModel) {
        const imagesToDelete = await this.imageModel.find({ 
          [this.getImageForeignKey()]: review._id 
        });
        
        if (imagesToDelete.length > 0) {
          // Xóa từ Cloudinary
          for (const image of imagesToDelete) {
            const publicId = image.url.split('/').pop().split('.')[0];
            try {
              await cloudinary.uploader.destroy(`e-commerce/${publicId}`);
            } catch (cloudinaryError) {
              console.log('Error deleting from cloudinary:', cloudinaryError);
            }
          }

          // Xóa image records
          await this.imageModel.deleteMany({ 
            [this.getImageForeignKey()]: review._id 
          });
        }
      }

      // Xóa review
      await this.model.findByIdAndDelete(req.params.id);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Xóa đánh giá thành công',
        data: null
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
  getReviewById: reviewController.getById.bind(reviewController),
  getReviewsByPet: reviewController.getReviewsByPet.bind(reviewController),
  getMyReviews: reviewController.getMyReviews.bind(reviewController),
  updateReview: reviewController.update.bind(reviewController),
  deleteReview: reviewController.delete.bind(reviewController),
  hideReviewsForRatedProduct: reviewController.hideReviewsForRatedProduct.bind(reviewController)
};