const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: { type: String, required: true },
  message: { type: String, required: true },
  is_read: { type: Boolean, default: false },
  related_entity_id: { type: mongoose.Schema.Types.ObjectId, required: false }, // Cho phép null cho thông báo hệ thống
  related_entity_type: { type: String, required: false }, // Cho phép null cho thông báo hệ thống
  created_at: { type: Date, default: Date.now },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

module.exports = mongoose.model('Notification', notificationSchema);