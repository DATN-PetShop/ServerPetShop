const mongoose = require('mongoose');

const breedImageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  is_primary: {
    type: Boolean,
    default: false
  },
  breed_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Breed',
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('BreedImage', breedImageSchema);