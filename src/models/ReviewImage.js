// src/models/ReviewImage.js
const mongoose = require('mongoose');

const reviewImageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    description: 'URL của ảnh đánh giá trên Cloudinary'
  },
  is_primary: {
    type: Boolean,
    default: false,
    description: 'Ảnh chính của đánh giá'
  },
  review_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review',
    required: true,
    description: 'ID của đánh giá liên kết'
  },
  created_at: {
    type: Date,
    default: Date.now,
    description: 'Thời điểm tạo ảnh'
  }
});

// Index để tối ưu query
reviewImageSchema.index({ review_id: 1 });
reviewImageSchema.index({ is_primary: 1 });

module.exports = mongoose.model('ReviewImage', reviewImageSchema);