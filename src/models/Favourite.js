const mongoose = require('mongoose');

const favouriteSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  created_at: { type: Date, default: Date.now }
});

favouriteSchema.index({ user_id: 1, product_id: 1 }, { unique: true }); // không cho trùng

module.exports = mongoose.model('Favourite', favouriteSchema);
