// src/models/Favourite.js - ENHANCED VERSION với better error handling
const mongoose = require('mongoose');

const favouriteSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// ✅ ENHANCED COMPOUND UNIQUE INDEXES
favouriteSchema.index(
  { user_id: 1, product_id: 1 }, 
  { 
    unique: true,
    partialFilterExpression: { 
      product_id: { $ne: null, $exists: true } 
    },
    name: 'user_product_unique'
  }
);

favouriteSchema.index(
  { user_id: 1, pet_id: 1 }, 
  { 
    unique: true,
    partialFilterExpression: { 
      pet_id: { $ne: null, $exists: true } 
    },
    name: 'user_pet_unique'
  }
);

// ✅ GENERAL INDEX for faster queries
favouriteSchema.index({ user_id: 1, created_at: -1 });

// ✅ ENHANCED VALIDATION với better error messages
favouriteSchema.pre('save', function(next) {
  if (!this.product_id && !this.pet_id) {
    const error = new Error('Either product_id or pet_id must be provided');
    error.name = 'ValidationError';
    return next(error);
  }
  
  if (this.product_id && this.pet_id) {
    const error = new Error('Cannot have both product_id and pet_id');
    error.name = 'ValidationError';
    return next(error);
  }
  
  // ✅ UPDATE updated_at on save
  this.updated_at = new Date();
  next();
});

// ✅ ENHANCED STATIC METHODS
favouriteSchema.statics.findByUserAndItem = function(userId, itemId, itemType) {
  const filter = { user_id: userId };
  if (itemType === 'product') {
    filter.product_id = itemId;
    filter.pet_id = { $in: [null, undefined] };
  } else if (itemType === 'pet') {
    filter.pet_id = itemId;
    filter.product_id = { $in: [null, undefined] };
  }
  return this.findOne(filter);
};

// ✅ NEW: Safe add method with duplicate handling
favouriteSchema.statics.safeAdd = async function(data) {
  try {
    const favourite = new this(data);
    return await favourite.save();
  } catch (error) {
    if (error.code === 11000) {
      // ✅ DUPLICATE KEY ERROR - find and return existing
      console.log('Duplicate key detected, finding existing favourite...');
      
      const filter = { user_id: data.user_id };
      if (data.product_id) filter.product_id = data.product_id;
      if (data.pet_id) filter.pet_id = data.pet_id;
      
      const existing = await this.findOne(filter);
      if (existing) {
        return { favourite: existing, isExisting: true };
      }
    }
    throw error;
  }
};

// ✅ NEW: Safe remove method 
favouriteSchema.statics.safeRemove = async function(data) {
  const filter = { user_id: data.user_id };
  if (data.product_id) filter.product_id = data.product_id;
  if (data.pet_id) filter.pet_id = data.pet_id;
  
  const deleted = await this.findOneAndDelete(filter);
  return { deleted, wasExisting: !!deleted };
};

// ✅ INSTANCE METHODS
favouriteSchema.methods.getItemType = function() {
  if (this.product_id) return 'product';
  if (this.pet_id) return 'pet';
  return null;
};

favouriteSchema.methods.getItemId = function() {
  return this.product_id || this.pet_id;
};

// ✅ VIRTUAL để get item info
favouriteSchema.virtual('itemInfo').get(function() {
  return {
    type: this.getItemType(),
    id: this.getItemId()
  };
});

// ✅ JSON TRANSFORM để include virtuals
favouriteSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Favourite', favouriteSchema);