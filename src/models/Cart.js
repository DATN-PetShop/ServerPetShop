// src/models/Cart.js
const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pet_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pet',
    default: null
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product', 
    default: null
  },
   variant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PetVariant',
    default: null
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  added_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Cập nhật validation middleware:
cartSchema.pre('save', function(next) {
  // Phải có ít nhất một trong pet_id, product_id, hoặc variant_id
  if (!this.pet_id && !this.product_id && !this.variant_id) {
    return next(new Error('Cart item must have either pet_id, product_id, or variant_id'));
  }
  
  // Chỉ được có một loại item
  const itemTypes = [this.pet_id, this.product_id, this.variant_id].filter(Boolean);
  if (itemTypes.length > 1) {
    return next(new Error('Cart item can only have one of: pet_id, product_id, or variant_id'));
  }
  
  next();
});

// Cập nhật static method findExistingItem:
cartSchema.statics.findExistingItem = function(user_id, pet_id, product_id, variant_id) {
  console.log('🔍 Finding existing item:', { user_id, pet_id, product_id, variant_id });
  
  const query = { 
    user_id: new mongoose.Types.ObjectId(user_id) 
  };
  
  if (variant_id && !pet_id && !product_id) {
    // Tìm variant item
    query.variant_id = new mongoose.Types.ObjectId(variant_id);
    query.pet_id = { $in: [null, undefined] };
    query.product_id = { $in: [null, undefined] };
  } else if (pet_id && !product_id && !variant_id) {
    // Tìm pet item (legacy)  
    query.pet_id = new mongoose.Types.ObjectId(pet_id);
    query.product_id = { $in: [null, undefined] };
    query.variant_id = { $in: [null, undefined] };
  } else if (product_id && !pet_id && !variant_id) {
    // Tìm product item
    query.product_id = new mongoose.Types.ObjectId(product_id);
    query.pet_id = { $in: [null, undefined] };
    query.variant_id = { $in: [null, undefined] };
  } else {
    console.log('❌ Invalid findExistingItem call');
    return Promise.resolve(null);
  }
  
  return this.findOne(query);
};

// Cập nhật instance methods:
cartSchema.methods.getItemType = function() {
  if (this.variant_id) return 'variant';
  if (this.pet_id) return 'pet';
  return 'product';
};

cartSchema.methods.getItemId = function() {
  return this.variant_id || this.pet_id || this.product_id;
};

module.exports = mongoose.model('Cart', cartSchema);