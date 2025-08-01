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
    enum: ['text', 'image'],
    default: 'text'
  },
  image_url: {
    type: String,
    trim: true
  },
  sender_role: {
    type: String,
    enum: ['User', 'Staff', 'Admin'],
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

chatMessageSchema.pre('save', function(next) {
  if (this.message_type === 'image' && !this.image_url) {
    return next(new Error('image_url is required for image messages'));
  }
  
  // Nếu là text message thì không cần image_url
  if (this.message_type === 'text' && this.image_url) {
    this.image_url = undefined;
  }
  
  next();
});

chatMessageSchema.index({ room_id: 1, created_at: -1 }); // Quan trọng nhất
chatMessageSchema.index({ sender_id: 1 });

chatMessageSchema.statics.createTextMessage = function(roomId, senderId, content, senderRole) {
  return new this({
    room_id: roomId,
    sender_id: senderId,
    content: content,
    message_type: 'text',
    sender_role: senderRole
  });
};

chatMessageSchema.statics.createImageMessage = function(roomId, senderId, imageUrl, caption, senderRole) {
  return new this({
    room_id: roomId,
    sender_id: senderId,
    content: caption || 'Đã gửi một hình ảnh',
    message_type: 'image',
    image_url: imageUrl,
    sender_role: senderRole
  });
};

// Static method để lấy tin nhắn cuối cùng của room
chatMessageSchema.statics.getLastMessageInRoom = function(roomId) {
  return this.findOne({ room_id: roomId })
    .sort({ created_at: -1 })
    .populate('sender_id', 'username role avatar_url');
};

chatMessageSchema.statics.getChatHistory = function(roomId, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  return this.find({ room_id: roomId })
    .populate('sender_id', 'username role avatar_url')
    .sort({ created_at: 1 }) // Cũ nhất lên đầu cho lịch sử
    .skip(skip)
    .limit(limit);
};

module.exports = mongoose.model('ChatMessage', chatMessageSchema);