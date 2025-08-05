// models/Review.js - Updated version
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  rating: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 5, 
    description: 'Đánh giá từ 1 đến 5'
  },
  comment: { 
    type: String, 
    required: true, 
    description: 'Bình luận của người dùng'
  },
  created_at: { 
    type: Date, 
    default: Date.now, 
    description: 'Thời điểm tạo đánh giá'
  },
  pet_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Pet', 
    required: true, 
    description: 'ID của thú cưng liên kết với đánh giá'
  },
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    description: 'ID của người dùng tạo đánh giá'
  },
  product_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: false, 
    description: 'ID của sản phẩm liên kết với đánh giá (tùy chọn)'
  },
  // ✅ THÊM TRƯỜNG MỚI ĐỂ LIÊN KẾT VỚI ORDER ITEM
  order_item_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OrderItem',
    required: false,
    description: 'ID của order item được đánh giá (để tránh đánh giá trùng lặp)'
  }
});

// ✅ THÊM INDEX ĐỂ TỐI ƯU HIỆU SUẤT TRUY VẤN
reviewSchema.index({ user_id: 1, pet_id: 1 });
reviewSchema.index({ user_id: 1, product_id: 1 });
reviewSchema.index({ order_item_id: 1 });

// ✅ MIDDLEWARE ĐỂ KIỂM TRA KHÔNG ĐƯỢC ĐÁNH GIÁ TRÙNG LẶP
reviewSchema.pre('save', async function(next) {
  try {
    // Nếu có order_item_id, kiểm tra xem đã có review cho order item này chưa
    if (this.order_item_id && this.isNew) {
      const existingReview = await mongoose.model('Review').findOne({
        order_item_id: this.order_item_id,
        user_id: this.user_id
      });

      if (existingReview) {
        const error = new Error('Bạn đã đánh giá order item này rồi');
        error.statusCode = 400;
        return next(error);
      }
    }

    // Kiểm tra không được đánh giá cùng 1 pet/product nhiều lần từ cùng 1 user
    if (this.isNew) {
      const query = { user_id: this.user_id };
      
      if (this.pet_id) {
        query.pet_id = this.pet_id;
      }
      
      if (this.product_id) {
        query.product_id = this.product_id;
      }

      const existingReview = await mongoose.model('Review').findOne(query);
      
      if (existingReview) {
        const error = new Error('Bạn đã đánh giá sản phẩm/thú cưng này rồi');
        error.statusCode = 400;
        return next(error);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Review', reviewSchema);