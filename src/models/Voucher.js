const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  discount_type: { 
    type: String, 
    required: true, 
    enum: ['percentage', 'fixed'], 
    description: 'Loại giảm giá (percentage hoặc fixed)'
  },
  min_purchase_amount: { 
    type: Number, 
    required: true, 
    description: 'Số tiền tối thiểu để áp dụng voucher'
  },
  expiry_date: { 
    type: Date, 
    required: true, 
    description: 'Ngày hết hạn của voucher'
  },
  max_usage: { 
    type: Number, 
    default: 1, 
    description: 'Giới hạn số lần sử dụng tối đa'
  },
  used_count: { 
    type: Number, 
    default: 0, 
    description: 'Số lần voucher đã được sử dụng'
  },
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'pending', 'expired'], 
    default: 'active', 
    description: 'Trạng thái của voucher (active, inactive, pending, expired)'
  },
  created_at: { 
    type: Date, 
    default: Date.now, 
    description: 'Thời điểm tạo voucher'
  },
  updated_at: { 
    type: Date, 
    default: Date.now, 
    description: 'Thời điểm cập nhật voucher'
  },
  used_at: { 
    type: Date, 
    description: 'Thời điểm cuối cùng voucher được sử dụng'
  },
  saved_by_users: { 
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
    default: [], 
    description: 'Danh sách ID người dùng đã lưu voucher này'
  },
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    description: 'ID người dùng chính liên kết với voucher (cho mục đích quản lý)'
  },
  category_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category', 
    required: true, 
    description: 'ID danh mục liên kết với voucher'
  },
  created_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    description: 'ID người dùng (thường là admin) tạo voucher'
  },
  last_modified_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    description: 'ID người dùng (thường là admin) chỉnh sửa voucher cuối cùng'
  },
  discount_value: { 
    type: Number, 
    required: true, 
    description: 'Giá trị giảm giá (số phần trăm hoặc số tiền cố định)'
  }
});

voucherSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  if (this.used_count > 0 && !this.used_at) {
    this.used_at = Date.now(); // Gán used_at khi used_count tăng lần đầu
  }
  next();
});

module.exports = mongoose.model('Voucher', voucherSchema);