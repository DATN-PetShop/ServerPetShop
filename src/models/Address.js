const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  province: { type: String, required: true },
  addressDetail: { type: String, required: true },
}, {
  timestamps: true
});

module.exports = mongoose.model('Address', addressSchema);
