// src/models/ChatRoom.js
const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assigned_staff_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'closed'],
    default: 'waiting'
  },
  subject: {
    type: String,
    default: 'Customer Support'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  last_message_at: {
    type: Date,
    default: Date.now
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
chatRoomSchema.index({ assigned_staff_id: 1 });
chatRoomSchema.index({ status: 1 });
chatRoomSchema.index({ created_at: -1 });

// Method để kiểm tra quyền truy cập
chatRoomSchema.methods.hasAccess = function(userId, userRole) {
  // Customer chỉ truy cập room của mình
  if (userRole === 'User') {
    return this.customer_id.toString() === userId;
  }
  
  // Staff truy cập room được assign hoặc chưa assign
  if (userRole === 'Staff') {
    return !this.assigned_staff_id || this.assigned_staff_id.toString() === userId;
  }
  
  // Admin truy cập tất cả
  if (userRole === 'Admin') {
    return true;
  }
  
  return false;
};

// Static method để tìm room active của customer
chatRoomSchema.statics.findActiveRoomByCustomer = function(customerId) {
  return this.findOne({
    customer_id: customerId,
    status: { $in: ['waiting', 'active'] }
  });
};

module.exports = mongoose.model('ChatRoom', chatRoomSchema);