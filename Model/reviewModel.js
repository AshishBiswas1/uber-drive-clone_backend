const mongoose = require('mongoose');

const reviewSchema = mongoose.Schema({});

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
