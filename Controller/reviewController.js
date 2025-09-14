// Controller/reviewController.js
const Review = require('./../Model/reviewModel');
const catchAsync = require('./../util/catchAsync');
const AppError = require('./../util/appError');
const APIFeatures = require('./../util/apiFeatures');

// ===========================================
// ADMIN FUNCTIONS - BASIC CRUD OPERATIONS
// ===========================================

// GET ALL REVIEWS (Admin)
exports.getAllReviews = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Review.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const reviews = await features.query;
  const totalReviews = await Review.countDocuments();

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    totalReviews,
    data: {
      reviews,
    },
  });
});

// GET SINGLE REVIEW (Admin)
exports.getReview = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const review = await Review.findById(id);

  if (!review) {
    return next(new AppError('No review found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      review,
    },
  });
});

// CREATE REVIEW (Admin)
exports.createReview = catchAsync(async (req, res, next) => {
  const {
    trip,
    rider,
    driver,
    rating,
    comment,
    tags,
    categoryRatings,
    status = 'active',
  } = req.body;

  // Check existing review
  const existingReview = await Review.findWithoutPopulate({ trip });
  if (existingReview.length > 0) {
    return next(new AppError('Review already exists for this trip', 400));
  }

  // Create review - validation handled by model
  const newReview = await Review.create({
    trip,
    rider,
    driver,
    rating,
    comment: comment || '',
    tags: tags || [],
    categoryRatings: categoryRatings || {
      driving: rating,
      punctuality: rating,
      vehicleCondition: rating,
      behavior: rating,
    },
    status,
  });

  // Update driver rating
  await updateDriverRating(driver);

  res.status(201).json({
    status: 'success',
    message: 'Review created successfully',
    data: {
      review: newReview,
    },
  });
});

// UPDATE REVIEW (Admin)
exports.updateReview = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  // Remove fields that shouldn't be updated
  delete updateData._id;
  delete updateData.createdAt;
  delete updateData.__v;
  updateData.updatedAt = new Date();

  const review = await Review.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!review) {
    return next(new AppError('No review found with that ID', 404));
  }

  // Update driver rating if rating was changed
  if (updateData.rating) {
    await updateDriverRating(review.driver._id);
  }

  res.status(200).json({
    status: 'success',
    message: 'Review updated successfully',
    data: {
      review,
    },
  });
});

// DELETE REVIEW (Admin)
exports.deleteReview = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const review = await Review.findById(id);

  if (!review) {
    return next(new AppError('No review found with that ID', 404));
  }

  const driverId = review.driverId;
  await Review.findByIdAndDelete(id);
  await updateDriverRating(driverId);

  res.status(204).json({
    status: 'success',
    message: 'Review deleted successfully',
    data: null,
  });
});

// ===========================================
// ADDITIONAL ADMIN UTILITY FUNCTIONS
// ===========================================

// UPDATE REVIEW STATUS (Admin)
exports.updateReviewStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['active', 'hidden', 'reported'];
  if (!validStatuses.includes(status)) {
    return next(
      new AppError('Status must be one of: active, hidden, reported', 400)
    );
  }

  const review = await Review.findByIdAndUpdate(
    id,
    { status, updatedAt: new Date() },
    { new: true, runValidators: true }
  );

  if (!review) {
    return next(new AppError('No review found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    message: `Review status updated to ${status}`,
    data: {
      review,
    },
  });
});

// GET REVIEWS STATISTICS (Admin)
exports.getReviewsStats = catchAsync(async (req, res, next) => {
  const stats = await Review.aggregate([
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        activeReviews: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
        },
        hiddenReviews: {
          $sum: { $cond: [{ $eq: ['$status', 'hidden'] }, 1, 0] },
        },
        reportedReviews: {
          $sum: { $cond: [{ $eq: ['$status', 'reported'] }, 1, 0] },
        },
        averageRating: { $avg: '$rating' },
        totalHelpfulVotes: { $sum: '$helpfulVotes' },
      },
    },
  ]);

  const ratingDistribution = await Review.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const monthlyTrends = await Review.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        count: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      overallStats: stats[0] || {
        totalReviews: 0,
        activeReviews: 0,
        hiddenReviews: 0,
        reportedReviews: 0,
        averageRating: 0,
        totalHelpfulVotes: 0,
      },
      ratingDistribution,
      monthlyTrends,
    },
  });
});

// ===========================================
// PUBLIC/USER FUNCTIONS
// ===========================================

// GET DRIVER REVIEWS (Public/Driver)
exports.getDriverReviews = catchAsync(async (req, res, next) => {
  const { driverId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const reviews = await Review.find({
    driverId,
    status: 'active',
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalReviews = await Review.countDocuments({
    driverId,
    status: 'active',
  });

  const ratingStats = await Review.getDriverAverageRating(driverId);

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    totalReviews,
    currentPage: page,
    totalPages: Math.ceil(totalReviews / limit),
    driverStats: ratingStats,
    data: {
      reviews,
    },
  });
});

// GET RIDER REVIEWS (Reviews written by a specific rider)
exports.getRiderReviews = catchAsync(async (req, res, next) => {
  const riderId = req.user.id; // Get from authenticated user
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const reviews = await Review.find({
    riderId,
    status: 'active',
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalReviews = await Review.countDocuments({
    riderId,
    status: 'active',
  });

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    totalReviews,
    currentPage: page,
    totalPages: Math.ceil(totalReviews / limit),
    data: {
      reviews,
    },
  });
});

// CREATE REVIEW BY RIDER (After trip completion)
exports.createRiderReview = catchAsync(async (req, res, next) => {
  const riderId = req.user.id; // From protect middleware
  const { tripId } = req.params;
  const { rating, comment, tags, categoryRatings, media } = req.body;

  // Check existing review
  const existingReview = await Review.findWithoutPopulate({ tripId });
  if (existingReview.length > 0) {
    return next(new AppError('Review already exists for this trip', 400));
  }

  // Create review - model will validate all required fields and constraints
  const newReview = await Review.create({
    tripId,
    riderId,
    driverId: req.body.driverId, // Should be provided in request
    rating,
    comment: comment || '',
    tags: tags || [],
    categoryRatings: categoryRatings || {
      driving: rating,
      punctuality: rating,
      vehicleCondition: rating,
      behavior: rating,
    },
    media: media || [],
  });

  // Update driver's average rating
  await updateDriverRating(newReview.driver);

  res.status(201).json({
    status: 'success',
    message: 'Review created successfully!',
    data: {
      review: newReview,
    },
  });
});

// UPDATE RIDER'S OWN REVIEW
exports.updateRiderReview = catchAsync(async (req, res, next) => {
  const reviewId = req.params.id;
  const riderId = req.user.id;
  const { rating, comment, tags, categoryRatings } = req.body;

  // Find review
  const review = await Review.findById(reviewId);

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  // Check if rider owns this review
  if (review.rider._id.toString() !== riderId) {
    return next(new AppError('You can only update your own reviews', 403));
  }

  // Check if review was created within last 24 hours (optional business rule)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (review.createdAt < oneDayAgo) {
    return next(
      new AppError(
        'Reviews can only be updated within 24 hours of creation',
        400
      )
    );
  }

  // Update review
  const updatedReview = await Review.findByIdAndUpdate(
    reviewId,
    {
      rating: rating || review.rating,
      comment: comment !== undefined ? comment : review.comment,
      tags: tags || review.tags,
      categoryRatings: categoryRatings || review.categoryRatings,
      updatedAt: new Date(),
    },
    { new: true, runValidators: true }
  );

  // Update driver's average rating if rating changed
  if (rating && rating !== review.rating) {
    await updateDriverRating(review.driver);
  }

  res.status(200).json({
    status: 'success',
    message: 'Review updated successfully!',
    data: {
      review: updatedReview,
    },
  });
});

// ===========================================
// INTERACTION FUNCTIONS
// ===========================================

// MARK REVIEW AS HELPFUL
exports.markReviewHelpful = catchAsync(async (req, res, next) => {
  const { reviewId } = req.params;
  const userId = req.user.id;
  const userType = req.user.role === 'driver' ? 'Driver' : 'Rider';

  const review = await Review.findById(reviewId);

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  // Check if user already voted
  const existingVote = review.helpfulBy.find(
    (vote) => vote.userId.toString() === userId && vote.userType === userType
  );

  if (existingVote) {
    return next(
      new AppError('You have already marked this review as helpful', 400)
    );
  }

  await review.markHelpful(userId, userType);

  res.status(200).json({
    status: 'success',
    message: 'Review marked as helpful',
    data: {
      helpfulVotes: review.helpfulVotes,
    },
  });
});

// REPORT REVIEW
exports.reportReview = catchAsync(async (req, res, next) => {
  const { reviewId } = req.params;
  const { reason } = req.body;
  const userId = req.user.id;
  const userType = req.user.role === 'driver' ? 'Driver' : 'Rider';

  if (!reason) {
    return next(new AppError('Please provide a reason for reporting', 400));
  }

  const review = await Review.findById(reviewId);

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  // Check if user already reported
  const existingReport = review.reportedBy.find(
    (report) =>
      report.userId.toString() === userId && report.userType === userType
  );

  if (existingReport) {
    return next(new AppError('You have already reported this review', 400));
  }

  await review.reportReview(userId, userType, reason);

  res.status(200).json({
    status: 'success',
    message: 'Review reported successfully',
  });
});

// DRIVER RESPONSE TO REVIEW
exports.addDriverResponse = catchAsync(async (req, res, next) => {
  const { reviewId } = req.params;
  const { response } = req.body;
  const driverId = req.user.id;

  if (!response || response.trim().length === 0) {
    return next(new AppError('Please provide a response', 400));
  }

  const review = await Review.findById(reviewId);

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  // Check if driver is the one being reviewed
  if (review.driverId.toString() !== driverId) {
    return next(new AppError('You can only respond to reviews about you', 403));
  }

  // Check if response already exists
  if (review.response && review.response.comment) {
    return next(new AppError('You have already responded to this review', 400));
  }

  await review.addDriverResponse(response.trim());

  res.status(200).json({
    status: 'success',
    message: 'Response added successfully',
    data: {
      response: review.response,
    },
  });
});

// ===========================================
// HELPER FUNCTIONS
// ===========================================

// Helper function to update driver's average rating
async function updateDriverRating(driverId) {
  try {
    const Driver = require('./../Model/driverModel'); // Import here to avoid circular dependency
    const ratingStats = await Review.getDriverAverageRating(driverId);

    await Driver.findByIdAndUpdate(driverId, {
      rating: ratingStats.averageRating || 0,
      totalReviews: ratingStats.totalReviews || 0,
    });

    console.log(
      `✅ Updated driver ${driverId} rating to ${ratingStats.averageRating}`
    );
  } catch (error) {
    console.error(`❌ Failed to update driver rating:`, error);
  }
}

// GET TOP 5 REVIEWS (Mixed - Riders and Drivers)
exports.getTopReviews = catchAsync(async (req, res, next) => {
  const topReviews = await Review.aggregate([
    {
      $match: {
        status: 'active',
      },
    },
    {
      $sort: {
        rating: -1,
        helpfulVotes: -1,
        createdAt: -1,
      },
    },
    {
      $limit: 5,
    },
    {
      $lookup: {
        from: 'riders',
        localField: 'riderId',
        foreignField: '_id',
        as: 'rider',
      },
    },
    {
      $lookup: {
        from: 'drivers',
        localField: 'driverId',
        foreignField: '_id',
        as: 'driver',
      },
    },
    {
      $lookup: {
        from: 'trips',
        localField: 'tripId',
        foreignField: '_id',
        as: 'trip',
      },
    },
    {
      $project: {
        rating: 1,
        comment: 1,
        tags: 1,
        categoryRatings: 1,
        helpfulVotes: 1,
        createdAt: 1,
        'rider.name': 1,
        'rider.photo': 1,
        'driver.name': 1,
        'driver.photo': 1,
        'driver.rating': 1,
        'trip.pickupLocation.address': 1,
        'trip.dropoffLocation.address': 1,
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    results: topReviews.length,
    data: {
      topReviews,
    },
  });
});
