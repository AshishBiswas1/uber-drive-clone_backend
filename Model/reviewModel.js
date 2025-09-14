// Model/reviewModel.js
const mongoose = require('mongoose');
const AppError = require('../util/appError'); // Assuming you have AppError for consistency

const reviewSchema = new mongoose.Schema(
  {
    // Trip Reference
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: [true, 'A review must belong to a trip.'],
    },

    // Rider (Who is giving the review)
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rider',
      required: [true, 'A review must have a rider.'],
    },

    // Driver (Who is being reviewed)
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: [true, 'A review must be for a driver.'],
    },

    // Rating with enhanced validation
    rating: {
      type: Number,
      required: [true, 'A rating is required.'],
      min: [1, 'Rating must be at least 1.'],
      max: [5, 'Rating cannot be more than 5.'],
      validate: {
        validator: function (value) {
          return Number.isInteger(value) || (value * 2) % 1 === 0;
        },
        message: 'Rating must be a whole or half number (e.g., 4.5).',
      },
    },

    categoryRatings: {
      driving: { type: Number, min: 1, max: 5 },
      punctuality: { type: Number, min: 1, max: 5 },
      vehicleCondition: { type: Number, min: 1, max: 5 },
      behavior: { type: Number, min: 1, max: 5 },
    },

    comment: {
      type: String,
      trim: true,
      maxlength: [500, 'Comment cannot exceed 500 characters.'],
      default: '',
    },

    tags: [
      {
        type: String,
        enum: [
          'excellent_driver',
          'safe_driving',
          'clean_car',
          'friendly',
          'punctual',
          'smooth_ride',
          'good_music',
          'helpful',
          'polite',
          'professional',
          'late_arrival',
          'rude_behavior',
          'unsafe_driving',
          'dirty_car',
          'cancelled_trip',
          'overcharging',
          'poor_navigation',
          'quiet_ride',
          'average_experience',
        ],
      },
    ],

    status: {
      type: String,
      enum: ['active', 'hidden', 'reported'],
      default: 'active',
    },

    helpfulVotes: {
      type: Number,
      default: 0,
      min: 0,
    },

    helpfulBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'helpfulBy.userType',
        },
        userType: {
          type: String,
          // ✅ FIX: Added 'Admin' to allow admins to mark as helpful
          enum: ['Rider', 'Driver', 'Admin', 'admin'],
        },
      },
    ],

    response: {
      comment: {
        type: String,
        trim: true,
        maxlength: [300, 'Response cannot exceed 300 characters.'],
      },
      respondedAt: Date,
    },

    media: [
      {
        type: { type: String, enum: ['image'], required: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    isReported: {
      type: Boolean,
      default: false,
    },

    reportedBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'reportedBy.userType',
        },
        userType: {
          type: String,
          // ✅ FIX: Added 'Admin' to allow admins to report
          enum: ['Rider', 'Driver', 'Admin', 'admin'],
        },
        reason: {
          type: String,
        },
        reportedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ===========================================
// INDEXES
// ===========================================
reviewSchema.index({ trip: 1 }, { unique: true });
reviewSchema.index({ driver: 1 });
reviewSchema.index({ rider: 1 });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ status: 1 });

// ===========================================
// QUERY MIDDLEWARE
// ===========================================
reviewSchema.pre(/^find/, function (next) {
  if (this.options._recursed) {
    return next();
  }

  this.populate({
    path: 'rider',
    select: 'name email phoneNo photo',
  })
    .populate({
      path: 'driver',
      select: 'name email phoneNo photo rating totalRides',
    })
    .populate({
      path: 'trip',
      select:
        'pickupLocation.address dropoffLocation.address createdAt fare.totalFare distance status',
    });

  next();
});

reviewSchema.pre('findOne', function (next) {
  if (this.options._recursed) {
    return next();
  }

  this.populate({
    path: 'rider',
    select: 'name email phoneNo photo totalRides',
  })
    .populate({
      path: 'driver',
      select: 'name email phoneNo photo rating totalRides vehicleType',
    })
    .populate({
      path: 'trip',
      select:
        'pickupLocation dropoffLocation createdAt fare distance duration status',
    });

  next();
});

// ===========================================
// VIRTUALS
// ===========================================
reviewSchema.virtual('riderName').get(function () {
  return this.rider?.name || 'Anonymous';
});

reviewSchema.virtual('driverName').get(function () {
  return this.driver?.name || 'Anonymous';
});

reviewSchema.virtual('averageCategoryRating').get(function () {
  const ratings = Object.values(this.categoryRatings || {}).filter(
    (r) => r != null
  );
  return ratings.length > 0
    ? ratings.reduce((a, b) => a + b) / ratings.length
    : this.rating;
});

// ===========================================
// MIDDLEWARE
// ===========================================
reviewSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

reviewSchema.pre('save', function (next) {
  if (this.rider.toString() === this.driver.toString()) {
    return next(new AppError('A user cannot review themselves.', 400));
  }
  next();
});

// ===========================================
// STATIC METHODS
// ===========================================
reviewSchema.statics.getDriverAverageRating = async function (driverId) {
  const stats = await this.aggregate([
    {
      $match: {
        driver: new mongoose.Types.ObjectId(driverId),
        status: 'active',
      },
    },
    {
      $group: {
        _id: '$driver',
        avgRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: { $push: '$rating' },
      },
    },
  ]);

  if (stats.length > 0) {
    return {
      averageRating: Math.round(stats[0].avgRating * 10) / 10,
      totalReviews: stats[0].totalReviews,
      ratingDistribution: stats[0].ratingDistribution,
    };
  }
  return { averageRating: 0, totalReviews: 0, ratingDistribution: [] };
};

reviewSchema.statics.findWithoutPopulate = function (query = {}) {
  return this.find(query, null, { _recursed: true });
};

// ===========================================
// INSTANCE METHODS
// ===========================================
reviewSchema.methods.markHelpful = function (userId, userType) {
  this.helpfulBy.push({ userId, userType });
  this.helpfulVotes += 1;
  return this.save();
};

reviewSchema.methods.reportReview = function (userId, userType, reason) {
  this.reportedBy.push({ userId, userType, reason, reportedAt: new Date() });
  this.isReported = true;
  this.status = 'reported';
  return this.save();
};

reviewSchema.methods.addDriverResponse = function (responseText) {
  this.response = {
    comment: responseText,
    respondedAt: new Date(),
  };
  return this.save();
};

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
