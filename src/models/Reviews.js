const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  pet_id: { type: Schema.Types.ObjectId, ref: 'Pet', required: true },
}, { timestamps: true }); 

module.exports = mongoose.model('Reviews', reviewSchema);