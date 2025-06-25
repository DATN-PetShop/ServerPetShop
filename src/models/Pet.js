const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  age: { type: Number },
  weight: { type: Number },
  gender: { type: String, enum: ['Male', 'Female'] },
  description: { type: String },
  status: { type: String, enum: ['available', 'sold', 'reserved'], default: 'available' },
  type: { type: String, required: true },
  breed_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Breed' },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

petSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Pet', petSchema);
