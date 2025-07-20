// src/models/Favourite.js - FIXED VERSION
const mongoose = require('mongoose');

const favouriteSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Hỗ trợ cả product và pet
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },
  pet_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pet', 
    default: null
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// ✅ COMPOUND UNIQUE INDEXES để ngăn trùng lặp
// Index cho product favourites: user + product phải unique
favouriteSchema.index(
  { user_id: 1, product_id: 1 }, 
  { 
    unique: true,
    partialFilterExpression: { product_id: { $ne: null } }
  }
);

// Index cho pet favourites: user + pet phải unique  
favouriteSchema.index(
  { user_id: 1, pet_id: 1 }, 
  { 
    unique: true,
    partialFilterExpression: { pet_id: { $ne: null } }
  }
);

// ✅ VALIDATION: phải có ít nhất một trong product_id hoặc pet_id
favouriteSchema.pre('save', function(next) {
  if (!this.product_id && !this.pet_id) {
    return next(new Error('Either product_id or pet_id must be provided'));
  }
  if (this.product_id && this.pet_id) {
    return next(new Error('Cannot have both product_id and pet_id'));
  }
  next();
});

// ✅ STATIC METHOD để tìm favourite
favouriteSchema.statics.findByUserAndItem = function(userId, itemId, itemType) {
  const filter = { user_id: userId };
  if (itemType === 'product') {
    filter.product_id = itemId;
  } else if (itemType === 'pet') {
    filter.pet_id = itemId;
  }
  return this.findOne(filter);
};

// ✅ INSTANCE METHOD để check loại favourite
favouriteSchema.methods.getItemType = function() {
  if (this.product_id) return 'product';
  if (this.pet_id) return 'pet';
  return null;
};

module.exports = mongoose.model('Favourite', favouriteSchema);