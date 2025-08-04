// src/models/ChatRoom.js
const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open'
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Middleware để tự động cập nhật updated_at
chatRoomSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

// Indexes để tối ưu performance
chatRoomSchema.index({ customer_id: 1 });
chatRoomSchema.index({ status: 1 });
chatRoomSchema.index({ created_at: -1 });

// Method để kiểm tra quyền truy cập (đơn giản hóa)
chatRoomSchema.methods.hasAccess = function(userId, userRole) {
  // Customer chỉ truy cập room của mình
  if (userRole === 'User') {
    return this.customer_id.toString() === userId;
  }
  
  // Staff và Admin truy cập tất cả
  if (['Staff', 'Admin'].includes(userRole)) {
    return true;
  }
  
  return false;
};

// Static method để tìm hoặc tạo room cho customer
chatRoomSchema.statics.findOrCreateRoom = async function(customerId) {
  // Tìm room đang mở của customer
  let room = await this.findOne({
    customer_id: customerId,
    status: 'open'
  });

  // Nếu không có thì tạo mới
  if (!room) {
    room = new this({
      customer_id: customerId,
      status: 'open'
    });
    await room.save();
  }

  return room;
};

// Static method để lấy danh sách rooms cho staff
chatRoomSchema.statics.getRoomsForStaff = function(page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ status: 'open' })
    .populate('customer_id', 'username email avatar_url')
    .sort({ updated_at: -1 })
    .skip(skip)
    .limit(limit);
};

module.exports = mongoose.model('ChatRoom', chatRoomSchema);