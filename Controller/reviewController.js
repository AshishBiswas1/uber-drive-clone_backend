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

  const existingReview = await Review.findWithoutPopulate({ trip });
  if (existingReview.length > 0) {
    return next(new AppError('Review already exists for this trip', 400));
  }

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

  const driverId = review.driver._id;
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
    { $group: { _id: '$rating', count: { $sum: 1 } } },
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
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        count: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      overallStats: stats[0] || {},
      ratingDistribution,
      monthlyTrends,
    },
  });
});

// ===========================================
// PUBLIC/USER FUNCTIONS
// ===========================================

exports.getDriverReviews = catchAsync(async (req, res, next) => {
  const driverId = req.params.driverId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const reviews = await Review.find({ driver: driverId, status: 'active' })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalReviews = await Review.countDocuments({
    driver: driverId,
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

exports.getRiderReviews = catchAsync(async (req, res, next) => {
  const riderId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const reviews = await Review.find({ rider: riderId, status: 'active' })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalReviews = await Review.countDocuments({
    rider: riderId,
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

exports.createRiderReview = catchAsync(async (req, res, next) => {
  const rider = req.user.id;
  const trip = req.params.tripId;
  const { driver, rating, comment, tags, categoryRatings, media } = req.body;

  const existingReview = await Review.findWithoutPopulate({ trip });
  if (existingReview.length > 0) {
    return next(new AppError('Review already exists for this trip', 400));
  }

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
    media: media || [],
  });

  await updateDriverRating(newReview.driver);

  res.status(201).json({
    status: 'success',
    message: 'Review created successfully!',
    data: {
      review: newReview,
    },
  });
});

exports.updateRiderReview = catchAsync(async (req, res, next) => {
  const reviewId = req.params.id;
  const riderId = req.user.id;
  const { rating, comment, tags, categoryRatings } = req.body;

  const review = await Review.findById(reviewId);

  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  if (review.rider._id.toString() !== riderId) {
    return next(new AppError('You can only update your own reviews', 403));
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (review.createdAt < oneDayAgo) {
    return next(
      new AppError(
        'Reviews can only be updated within 24 hours of creation',
        400
      )
    );
  }

  // Safely prepare update data
  const updateData = {};
  if (rating !== undefined) updateData.rating = rating;
  if (comment !== undefined) updateData.comment = comment;
  if (tags !== undefined) updateData.tags = tags;
  if (categoryRatings !== undefined)
    updateData.categoryRatings = categoryRatings;
  updateData.updatedAt = new Date();

  const updatedReview = await Review.findByIdAndUpdate(reviewId, updateData, {
    new: true,
    runValidators: true,
  });

  if (rating !== undefined && rating !== review.rating) {
    await updateDriverRating(review.driver._id);
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

exports.markReviewHelpful = catchAsync(async (req, res, next) => {
  const reviewId = req.params.id;
  const userId = req.user.id;
  const userType = req.user.role;

  const review = await Review.findById(reviewId);
  if (!review) {
    return next(new AppError('Review not found', 404));
  }

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

exports.reportReview = catchAsync(async (req, res, next) => {
  const reviewId = req.params.id;
  const { reason } = req.body;
  const userId = req.user.id;
  const userType = req.user.role;

  if (!reason) {
    return next(new AppError('Please provide a reason for reporting', 400));
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    return next(new AppError('Review not found', 404));
  }

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

exports.addDriverResponse = catchAsync(async (req, res, next) => {
  const reviewId = req.params.id;
  const { response } = req.body;
  const driverId = req.user.id;

  if (!response || response.trim().length === 0) {
    return next(new AppError('Please provide a response', 400));
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    return next(new AppError('Review not found', 404));
  }

  if (review.driver._id.toString() !== driverId) {
    return next(new AppError('You can only respond to reviews about you', 403));
  }

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

async function updateDriverRating(driverId) {
  try {
    const Driver = require('./../Model/driverModel');
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

exports.getTopReviews = catchAsync(async (req, res, next) => {
  const topReviews = await Review.aggregate([
    { $match: { status: 'active' } },
    { $sort: { rating: -1, helpfulVotes: -1, createdAt: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'riders',
        localField: 'rider',
        foreignField: '_id',
        as: 'rider',
      },
    },
    {
      $lookup: {
        from: 'drivers',
        localField: 'driver',
        foreignField: '_id',
        as: 'driver',
      },
    },
    {
      $lookup: {
        from: 'trips',
        localField: 'trip',
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
