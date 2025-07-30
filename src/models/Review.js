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
  updated_at: { 
    type: Date, 
    default: Date.now, 
    description: 'Thời điểm cập nhật đánh giá'
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
  is_hidden: {
    type: Boolean,
    default: false,
    description: 'Ẩn đánh giá khi sản phẩm đã được đánh giá'
  },
  helpful_count: {
    type: Number,
    default: 0,
    description: 'Số lượt đánh giá hữu ích'
  },
  reply_from_admin: {
    type: String,
    required: false,
    description: 'Phản hồi từ admin/shop'
  }
});

// Index để tối ưu query
reviewSchema.index({ pet_id: 1 });
reviewSchema.index({ user_id: 1 });
reviewSchema.index({ created_at: -1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ is_hidden: 1 });

// Middleware để tự động cập nhật updated_at
reviewSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updated_at: new Date() });
  next();
});

// Virtual để kiểm tra có thể chỉnh sửa không (trong 7 ngày)
reviewSchema.virtual('canEdit').get(function() {
  const createdAt = new Date(this.created_at);
  const now = new Date();
  const daysDifference = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
  return daysDifference <= 7;
});

// Virtual để format thời gian hiển thị
reviewSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const createdAt = new Date(this.created_at);
  const timeDiff = now - createdAt;
  
  const seconds = Math.floor(timeDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} năm trước`;
  if (months > 0) return `${months} tháng trước`;
  if (weeks > 0) return `${weeks} tuần trước`;
  if (days > 0) return `${days} ngày trước`;
  if (hours > 0) return `${hours} giờ trước`;
  if (minutes > 0) return `${minutes} phút trước`;
  return 'Vừa xong';
});

// Ensure virtual fields are serialized
reviewSchema.set('toJSON', { virtuals: true });
reviewSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Review', reviewSchema);