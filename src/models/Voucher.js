const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  discount_type: { type: String, required: true, enum: ['percentage', 'fixed'] },
  min_purchase_amount: { type: Number, required: true },
  expiry_date: { type: Date, required: true },
  max_usage: { type: Number, default: 1 },
  used_count: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true }
});

voucherSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Voucher', voucherSchema);