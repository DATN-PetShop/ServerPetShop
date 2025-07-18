const mongoose = require('mongoose');

const favouriteSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pet_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet' },
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

favouriteSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Favourite', favouriteSchema);