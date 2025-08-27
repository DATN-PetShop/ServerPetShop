// src/controllers/reviewController.js - Updated với Upload Images
const Review = require('../models/Review');
const ReviewImage = require('../models/ReviewImage');
const BaseCrudController = require('./baseCrudController');
const { cloudinary } = require('../config/cloudinaryConfig');
const mongoose = require('mongoose');
const OrderItem = require('../models/OrderItem');


class ReviewController extends BaseCrudController {
  constructor() {
    super(Review, ReviewImage);
  }

  getRequiredFields() {
    return ['rating', 'comment'];
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

  // Cập nhật đánh giá với ảnh
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
        .lean();

      // Thêm ảnh cho mỗi review
      if (this.imageModel) {
        for (let review of reviews) {
          const images = await this.imageModel.find({ 
            [this.getImageForeignKey()]: review._id 
          }).lean();
          review.images = images;
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
        message: 'Lỗi máy chủ nội bộ',
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

  // Lấy đánh giá theo Pet ID
// ✅ UPDATED: Lấy đánh giá theo Pet ID với pagination và stats
async getReviewsByPet(req, res) {
    try {
      const { petId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const rating = req.query.rating; // Filter theo rating (1-5)
      const skip = (page - 1) * limit;

      console.log('🔍 Getting reviews for pet:', petId);

      // ✅ Kiểm tra petId có hợp lệ không
      if (!mongoose.Types.ObjectId.isValid(petId)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Pet ID không hợp lệ',
          data: null
        });
      }

      // Build query
      let query = { pet_id: petId };
      if (rating) {
        query.rating = parseInt(rating);
      }

      const reviews = await this.model.find(query)
        .populate('user_id', 'username email avatar')
        .populate('product_id', 'name price') // Trong trường hợp pet được mua kèm product
        .sort({ created_at: -1 }) // Sắp xếp theo thời gian mới nhất
        .skip(skip)
        .limit(limit)
        .lean();

      // Thêm ảnh cho mỗi review
      if (this.imageModel) {
        for (let review of reviews) {
          const images = await this.imageModel.find({ 
            [this.getImageForeignKey()]: review._id 
          }).lean();
          review.images = images;
        }
      }

      // Đếm tổng số reviews và tính trung bình rating
      const totalReviews = await this.model.countDocuments(query);
      const totalPages = Math.ceil(totalReviews / limit);
      
      // ✅ FIXED: Tính rating statistics với ObjectId đúng cách
      const ratingStats = await this.model.aggregate([
        { $match: { pet_id: new mongoose.Types.ObjectId(petId) } }, // ✅ Sử dụng 'new'
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
            ratings: {
              $push: '$rating'
            }
          }
        }
      ]);

      // Tính distribution của từng rating
      const ratingDistribution = {};
      for (let i = 1; i <= 5; i++) {
        const count = await this.model.countDocuments({ 
          pet_id: petId, 
          rating: i 
        });
        ratingDistribution[`star${i}`] = count;
      }

      const stats = ratingStats.length > 0 ? {
        avgRating: Math.round(ratingStats[0].avgRating * 10) / 10, // Làm tròn 1 chữ số
        totalReviews: ratingStats[0].totalReviews,
        distribution: ratingDistribution
      } : {
        avgRating: 0,
        totalReviews: 0,
        distribution: {}
      };

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Lấy đánh giá theo pet thành công',
        data: {
          reviews,
          pagination: {
            currentPage: page,
            totalPages,
            totalReviews,
            hasMore: page < totalPages
          },
          stats
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
   // ✅ CUNG CẤP METHOD ĐỂ TẠO REVIEW TỪ ORDER ITEM
  async createReviewFromOrderItem(req, res) {
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

    const { orderItemId, ...reviewData } = req.body;
    const userId = req.user?.id;

    // Kiểm tra orderItemId
    if (orderItemId) {
      const orderItem = await OrderItem.findById(orderItemId)
        .populate('order_id', 'user_id status')
        .lean();

      if (!orderItem) {
        return res.status(404).json({
          success: false,
          statusCode: 404,
          message: 'Order item không tồn tại',
          data: null
        });
      }

      // Kiểm tra quyền sở hữu
      if (orderItem.order_id.user_id.toString() !== userId) {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          message: 'Bạn không có quyền đánh giá order item này',
          data: null
        });
      }

      // Kiểm tra trạng thái đơn hàng
      if (orderItem.order_id.status !== 'completed') {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Chỉ có thể đánh giá đơn hàng đã hoàn thành',
          data: null
        });
      }

      // Kiểm tra đã đánh giá chưa
      let existingReview = null;
      
      if (orderItem.pet_id) {
        existingReview = await Review.findOne({
          pet_id: orderItem.pet_id,
          user_id: userId
        }).lean();
      } else if (orderItem.product_id) {
        existingReview = await Review.findOne({
          product_id: orderItem.product_id,
          user_id: userId
        }).lean();
      }

      if (existingReview) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'Bạn đã đánh giá sản phẩm này rồi',
          data: null
        });
      }

      // Tự động điền pet_id hoặc product_id từ orderItem
      if (orderItem.pet_id && !reviewData.pet_id) {
        reviewData.pet_id = mongoose.Types.ObjectId.isValid(orderItem.pet_id) 
          ? orderItem.pet_id 
          : null; // Đảm bảo pet_id là ObjectId hợp lệ hoặc null
      }
      if (orderItem.product_id && !reviewData.product_id) {
        reviewData.product_id = mongoose.Types.ObjectId.isValid(orderItem.product_id) 
          ? orderItem.product_id 
          : null; // Đảm bảo product_id là ObjectId hợp lệ hoặc null
      }
    }

    // Kiểm tra required fields
    const requiredFields = this.getRequiredFields();
    const missingFields = requiredFields.filter(field => !reviewData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: `${missingFields.join(', ')} is required`,
        data: null
      });
    }

    // Kiểm tra và chuyển đổi pet_id, product_id nếu cần
    if (reviewData.pet_id && !mongoose.Types.ObjectId.isValid(reviewData.pet_id)) {
      reviewData.pet_id = null; // Chuyển chuỗi không hợp lệ thành null
    }
    if (reviewData.product_id && !mongoose.Types.ObjectId.isValid(reviewData.product_id)) {
      reviewData.product_id = null; // Chuyển chuỗi không hợp lệ thành null
    }

    // Tạo review data
    const finalReviewData = {
      ...reviewData,
      user_id: userId,
      order_item_id: orderItemId || null
    };

    // Tạo review
    const review = new this.model(finalReviewData);
    const savedReview = await review.save();

    // Xử lý upload ảnh nếu có
    if (this.imageModel && req.files && req.files.length > 0) {
      const imageDocs = req.files.map((file, index) => ({
        url: file.path,
        is_primary: index === 0,
        [this.getImageForeignKey()]: savedReview._id
      }));
      
      await this.imageModel.insertMany(imageDocs);
      
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
      data: {
        ...savedReview.toObject(),
        orderItemId: orderItemId
      }
    });
  } catch (error) {
    console.error('Lỗi khi tạo đánh giá từ order item:', error);
    res.status(400).json({
      success: false,
      statusCode: 400,
      message: error.message || 'Lỗi khi tạo đánh giá',
      data: null
    });
  }
}

    async getReviewsByProduct(req, res) {
    try {
      const { productId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const rating = req.query.rating; // Filter theo rating (1-5)
      const skip = (page - 1) * limit;

      // Build query
      let query = { product_id: productId };
      if (rating) {
        query.rating = parseInt(rating);
      }

      const reviews = await this.model.find(query)
        .populate('user_id', 'username email avatar')
        .sort({ created_at: -1 }) // Sắp xếp theo thời gian mới nhất
        .skip(skip)
        .limit(limit)
        .lean();

      // Thêm ảnh cho mỗi review
      if (this.imageModel) {
        for (let review of reviews) {
          const images = await this.imageModel.find({ 
            [this.getImageForeignKey()]: review._id 
          }).lean();
          review.images = images;
        }
      }

      // Đếm tổng số reviews và tính trung bình rating
      const totalReviews = await this.model.countDocuments(query);
      const totalPages = Math.ceil(totalReviews / limit);
      
      // Tính rating statistics
     const ratingStats = await this.model.aggregate([
        { $match: { pet_id: new mongoose.Types.ObjectId(productId) } }, // ✅ Sử dụng 'new'
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
            ratings: {
              $push: '$rating'
            }
          }
        }
      ]);

      // Tính distribution của từng rating
      const ratingDistribution = {};
      for (let i = 1; i <= 5; i++) {
        const count = await this.model.countDocuments({ 
          product_id: productId, 
          rating: i 
        });
        ratingDistribution[`star${i}`] = count;
      }

      const stats = ratingStats.length > 0 ? {
        avgRating: Math.round(ratingStats[0].avgRating * 10) / 10, // Làm tròn 1 chữ số
        totalReviews: ratingStats[0].totalReviews,
        distribution: ratingDistribution
      } : {
        avgRating: 0,
        totalReviews: 0,
        distribution: {}
      };

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Lấy đánh giá theo sản phẩm thành công',
        data: {
          reviews,
          pagination: {
            currentPage: page,
            totalPages,
            totalReviews,
            hasMore: page < totalPages
          },
          stats
        }
      });
    } catch (error) {
      console.error('Lỗi khi lấy đánh giá theo sản phẩm:', error);
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Lỗi máy chủ nội bộ',
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
  updateReview: reviewController.update.bind(reviewController),
  deleteReview: reviewController.delete.bind(reviewController),
  createReviewFromOrderItem: reviewController.createReviewFromOrderItem.bind(reviewController), // ✅ Thêm method mới
  getReviewsByProduct: reviewController.getReviewsByProduct.bind(reviewController), // ✅ Thêm method mới
};