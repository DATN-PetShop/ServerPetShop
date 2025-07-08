// src/models/ChatMessage.js
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  room_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true
  },
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  message_type: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  is_read: {
    type: Boolean,
    default: false
  },
  read_by: [{
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    read_at: {
      type: Date,
      default: Date.now
    }
  }],
  // Metadata cho file/image messages
  file_info: {
    original_name: String,
    file_size: Number,
    mime_type: String,
    file_url: String
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
chatMessageSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

// Indexes để tối ưu performance
chatMessageSchema.index({ room_id: 1, created_at: -1 }); // Quan trọng nhất
chatMessageSchema.index({ sender_id: 1 });
chatMessageSchema.index({ is_read: 1 });
chatMessageSchema.index({ created_at: -1 });

// Virtual để check xem message có phải của user không
chatMessageSchema.virtual('isFromUser').get(function() {
  return this.message_type !== 'system';
});

// Method để đánh dấu đã đọc
chatMessageSchema.methods.markAsReadBy = function(userId) {
  // Kiểm tra xem user đã đọc chưa
  const alreadyRead = this.read_by.some(
    readRecord => readRecord.user_id.toString() === userId
  );
  
  if (!alreadyRead) {
    this.read_by.push({
      user_id: userId,
      read_at: new Date()
    });
    
    // Nếu tất cả participants đã đọc thì đánh dấu is_read = true
    // [Suy luận] - Logic này có thể cần điều chỉnh tùy business logic
    this.is_read = true;
  }
  
  return this.save();
};

// Static method để đếm tin nhắn chưa đọc trong room
chatMessageSchema.statics.countUnreadInRoom = function(roomId, userId) {
  return this.countDocuments({
    room_id: roomId,
    sender_id: { $ne: userId }, // Không đếm tin nhắn của chính mình
    'read_by.user_id': { $ne: userId } // Chưa đọc bởi user này
  });
};

// Static method để lấy tin nhắn cuối cùng của room
chatMessageSchema.statics.getLastMessageInRoom = function(roomId) {
  return this.findOne({ room_id: roomId })
    .sort({ created_at: -1 })
    .populate('sender_id', 'username role');
};

module.exports = mongoose.model('ChatMessage', chatMessageSchema);