// src/models/Favourite.js - CẬP NHẬT
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

// Validation: phải có ít nhất một trong product_id hoặc pet_id
favouriteSchema.pre('save', function(next) {
  if (!this.product_id && !this.pet_id) {
    return next(new Error('Either product_id or pet_id must be provided'));
  }
  if (this.product_id && this.pet_id) {
    return next(new Error('Cannot have both product_id and pet_id'));
  }
  next();
});

// Index để tránh duplicate
favouriteSchema.index({ user_id: 1, product_id: 1, pet_id: 1 }, { unique: true });

module.exports = mongoose.model('Favourite', favouriteSchema);