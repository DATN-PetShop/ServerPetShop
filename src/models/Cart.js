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

// Validation middleware
cartSchema.pre('save', function(next) {
  // Phải có ít nhất một trong pet_id hoặc product_id
  if (!this.pet_id && !this.product_id) {
    return next(new Error('Cart item must have either pet_id or product_id'));
  }
  
  // Không được có cả hai
  if (this.pet_id && this.product_id) {
    return next(new Error('Cart item cannot have both pet_id and product_id'));
  }
  
  next();
});

// ✅ FIXED Static method để tìm cart item hiện có
cartSchema.statics.findExistingItem = function(user_id, pet_id, product_id) {
  console.log('🔍 Finding existing item:', { user_id, pet_id, product_id });
  
  const query = { 
    user_id: new mongoose.Types.ObjectId(user_id) 
  };
  
  if (pet_id && !product_id) {
    // Tìm pet item
    query.pet_id = new mongoose.Types.ObjectId(pet_id);
    query.product_id = { $in: [null, undefined] }; // ✅ Handle both null and undefined
  } else if (product_id && !pet_id) {
    // Tìm product item  
    query.product_id = new mongoose.Types.ObjectId(product_id);
    query.pet_id = { $in: [null, undefined] }; // ✅ Handle both null and undefined
  } else {
    // Invalid case
    console.log('❌ Invalid findExistingItem call - need either pet_id or product_id');
    return Promise.resolve(null);
  }
  
  console.log('🔍 Query:', JSON.stringify(query, null, 2));
  
  return this.findOne(query).then(result => {
    console.log('🔍 Found existing item:', result ? result._id : 'None');
    return result;
  });
};

// Instance method để check item type
cartSchema.methods.getItemType = function() {
  return this.pet_id ? 'pet' : 'product';
};

// Instance method để get item ID
cartSchema.methods.getItemId = function() {
  return this.pet_id || this.product_id;
};

module.exports = mongoose.model('Cart', cartSchema);