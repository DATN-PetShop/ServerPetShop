const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  loai: {
    type: String,
    enum: ['Thú cưng', 'Thức ăn'],
    default: 'Thú cưng'
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

// Pre-save middleware
categorySchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

// Create index for better performance
categorySchema.index({ name: 1 });
categorySchema.index({ loai: 1 });
categorySchema.index({ created_at: -1 });

module.exports = mongoose.model('Category', categorySchema);