// src/models/CareService.js
const mongoose = require('mongoose');

const careServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  duration: {
    type: Number, // Thời gian thực hiện (phút)
    required: true,
    min: 15
  },
  category: {
    type: String,
    required: true,
    enum: ['grooming', 'health', 'bathing', 'spa','other']
    },
  is_active: {
    type: Boolean,
    default: true
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

// Middleware để cập nhật updated_at
careServiceSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('CareService', careServiceSchema);