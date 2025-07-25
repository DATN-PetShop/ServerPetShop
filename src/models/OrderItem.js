const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  quantity: {
    type: Number,
    required: true
  },
  unit_price: {
    type: Number,
    required: true
  },
  pet_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pet',
    required: false // Bỏ required
  },
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false // Bỏ required
  },
  variant_id: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'PetVariant',
  required: false
},
  addresses_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address',
    required: true
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

// Hook để kiểm tra rằng ít nhất một trong hai trường pet_id hoặc product_id phải tồn tại
orderItemSchema.pre('save', function (next) {
  // Phải có ít nhất một trong: pet_id, product_id, hoặc variant_id
  if (!this.pet_id && !this.product_id && !this.variant_id) {
    return next(new Error('At least one of pet_id, product_id, or variant_id must be provided'));
  }
  
  // Chỉ được có một loại
  const hasMultiple = [this.pet_id, this.product_id, this.variant_id].filter(Boolean).length > 1;
  if (hasMultiple) {
    return next(new Error('Only one of pet_id, product_id, or variant_id can be provided'));
  }
  
  this.updated_at = Date.now();
  next();
});
module.exports = mongoose.model('OrderItem', orderItemSchema);