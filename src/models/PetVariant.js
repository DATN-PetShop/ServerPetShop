// src/models/PetVariant.js
const mongoose = require('mongoose');

const petVariantSchema = new mongoose.Schema({
  pet_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pet',
    required: true
  },
  
  // 4 biến thể chính
  color: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  
  weight: {
    type: Number,
    required: true,
    min: 0.1,
    max: 100 // kg
  },
  
  gender: {
    type: String,
    required: true,
    enum: ['Male', 'Female']
  },
  
  age: {
    type: Number,
    required: true,
    min: 0,
    max: 30 // years
  },
  
  // Thông tin bổ sung
  price_adjustment: {
    type: Number,
    default: 0, // Điều chỉnh giá so với giá gốc (+/-)
    min: -999999,
    max: 999999
  },
  
  stock_quantity: {
    type: Number,
    default: 1,
    min: 0
  },
  
  sku: {
    type: String,
    unique: true,
    sparse: true // Cho phép null
  },
  
  is_available: {
    type: Boolean,
    default: true
  },
  
  // Metadata
  created_at: {
    type: Date,
    default: Date.now
  },
  
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Indexes để tối ưu query
petVariantSchema.index({ pet_id: 1 });
petVariantSchema.index({ pet_id: 1, color: 1, weight: 1, gender: 1, age: 1 }, { unique: true });
petVariantSchema.index({ is_available: 1 });

// Pre-save middleware
petVariantSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  
  // Tự động tạo SKU nếu chưa có
  if (!this.sku) {
    const color = this.color.substring(0, 3).toUpperCase();
    const gender = this.gender.substring(0, 1).toUpperCase();
    this.sku = `${this.pet_id.toString().slice(-6)}-${color}-${this.weight}KG-${gender}-${this.age}Y`;
  }
  
  next();
});

// Static methods
petVariantSchema.statics.findByPetId = function(petId) {
  return this.find({ pet_id: petId, is_available: true });
};

petVariantSchema.statics.findAvailableVariants = function(petId, filters = {}) {
  const query = { pet_id: petId, is_available: true, stock_quantity: { $gt: 0 } };
  
  if (filters.color) query.color = new RegExp(filters.color, 'i');
  if (filters.gender) query.gender = filters.gender;
  if (filters.minAge) query.age = { $gte: filters.minAge };
  if (filters.maxAge) query.age = { ...query.age, $lte: filters.maxAge };
  if (filters.minWeight) query.weight = { $gte: filters.minWeight };
  if (filters.maxWeight) query.weight = { ...query.weight, $lte: filters.maxWeight };
  
  return this.find(query);
};

// Instance methods
petVariantSchema.methods.getFinalPrice = async function() {
  const pet = await mongoose.model('Pet').findById(this.pet_id);
  return pet ? pet.price + this.price_adjustment : this.price_adjustment;
};

petVariantSchema.methods.getDisplayName = function() {
  return `${this.color} - ${this.weight}kg - ${this.gender} - ${this.age} years`;
};

module.exports = mongoose.model('PetVariant', petVariantSchema);