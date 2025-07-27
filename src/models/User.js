// src/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password_hash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['Guest', 'User', 'Staff', 'Admin'],
    default: 'Guest',
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  phone: {
    type: String,
    trim: true,
  },
  avatar_url: {
    type: String,
    trim: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

// Index cho performance tốt hơn
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ created_at: -1 });

// Virtual field để check xem user có active không
userSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

// Instance method để activate user
userSchema.methods.activate = function() {
  this.status = 'active';
  return this.save();
};

// Instance method để deactivate user
userSchema.methods.deactivate = function() {
  this.status = 'inactive';
  return this.save();
};

// Static method để tìm users theo status
userSchema.statics.findByStatus = function(status) {
  return this.find({ status });
};

// Static method để tìm active customers
userSchema.statics.findActiveCustomers = function() {
  return this.find({ role: 'User', status: 'active' });
};

module.exports = mongoose.model('User', userSchema);