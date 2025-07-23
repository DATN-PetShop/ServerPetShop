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
  }
});

module.exports = mongoose.model('Review', reviewSchema);