const mongoose = require('mongoose');

const categoryImageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  is_primary: {
    type: Boolean,
    default: false
  },
  category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('CategoryImage', categoryImageSchema);