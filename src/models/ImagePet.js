const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  is_primary: {
    type: Boolean,
    default: false
  },
  pet_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pet',
    required: true
  }
});

module.exports = mongoose.model('ImagePet', imageSchema);
