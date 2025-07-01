const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  note: { type: String, required: true }, 
  province: { type: String, required: true }, 
  district: { type: String, required: true }, 
  ward: { type: String, required: true },     
  postal_code: { type: String, required: true },
  country: { type: String, required: true },
  is_default: { type: Boolean, default: false },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

addressSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Address', addressSchema);
