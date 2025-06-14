const mongoose = require('mongoose');

const productImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  is_primary: { type: Boolean, default: false },
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }
});

module.exports = mongoose.model('ProductImage', productImageSchema);
