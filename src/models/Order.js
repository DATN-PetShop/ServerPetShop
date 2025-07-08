const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  total_amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'cancelled'],
    default: 'pending'
  },
  payment_method: {
    type: String,
    enum: ['cod', 'vnpay'],
    required: true // Thêm trường để lưu phương thức thanh toán
  },
  vnpay_transaction_id: {
    type: String,
    required: false // Lưu mã giao dịch VNPay (nếu có)
  },
  payment_date: {
    type: String,
    required: false // Lưu thời gian thanh toán từ VNPay (nếu có)
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

orderSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Order', orderSchema);