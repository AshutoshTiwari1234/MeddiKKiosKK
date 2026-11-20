const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

module.exports = mongoose.model('Feedback', feedbackSchema);
