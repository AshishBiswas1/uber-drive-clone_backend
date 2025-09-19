// Model/riderModel.js - ENHANCED WITH MANUAL STATS TRACKING
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const riderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      validate: {
        validator: function (email) {
          return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
        },
        message: 'Please enter a valid email',
      },
    },

    phoneNo: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          // Accept multiple Indian phone formats
          return /^(\+91|91)?[6-9]\d{9}$/.test(v);
        },
        message:
          'Please enter a valid Indian phone number (e.g., +918755805252 or 8755805252)',
      },
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },

    passwordConfirm: {
      type: String,
      required: [true, 'Please confirm your password'],
      validate: {
        /*************  ✨ Windsurf Command ⭐  *************/
        /**
         * Validator function to check if the confirmed password matches the original password.
         * @return {boolean} True if the passwords match, false otherwise.
         */
        /*******  b324d580-af76-41a0-8654-7ea850bc9e4f  *******/
        validator: function (el) {
          return el === this.password;
        },
        message: 'Passwords do not match',
      },
    },

    photo: {
      type: String,
      default: 'default-rider.jpg',
    },

    role: {
      type: String,
      default: 'rider',
      enum: ['rider'],
    },

    active: {
      type: Boolean,
      default: true,
      select: false,
    },

    // ✅ UPDATED: Manual trip and payment tracking (updated in controller, not model)
    totalTrips: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    totalAmountSpent: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastPaymentDate: {
      type: Date,
      default: null,
    },

    // Stripe integration
    stripeCustomerId: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },

    // Location preferences
    homeAddress: {
      type: String,
      default: null,
    },

    workAddress: {
      type: String,
      default: null,
    },

    // Rider preferences
    preferences: {
      preferredVehicleType: {
        type: String,
        enum: ['any', 'sedan', 'suv', 'van'],
        default: 'any',
      },
      allowSharedRides: {
        type: Boolean,
        default: false,
      },
      smokingPreference: {
        type: String,
        enum: ['no-smoking', 'smoking-ok'],
        default: 'no-smoking',
      },
    },

    // Rating system
    averageRating: {
      type: Number,
      default: 5.0,
      min: 1,
      max: 5,
    },
    // Password reset functionality
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,

    // Account verification
    emailVerified: {
      type: Boolean,
      default: false,
    },

    phoneVerified: {
      type: Boolean,
      default: false,
    },

    verificationToken: String,
    verificationTokenExpires: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ✅ COMPOUND INDEXES
riderSchema.index({ totalTrips: -1, totalAmountSpent: -1 }); // For leaderboards
riderSchema.index({ createdAt: -1 }); // For recent users
riderSchema.index({ active: 1, emailVerified: 1 }); // For active verified users
riderSchema.index({ 'preferences.preferredVehicleType': 1 }); // For vehicle preference queries

// ✅ VIRTUAL: Calculate rider level based on trips
riderSchema.virtual('riderLevel').get(function () {
  const trips = this.totalTrips || 0;
  if (trips >= 100) return 'Gold';
  if (trips >= 50) return 'Silver';
  if (trips >= 10) return 'Bronze';
  return 'New';
});

// ✅ VIRTUAL: Average spending per trip
riderSchema.virtual('avgSpendingPerTrip').get(function () {
  if (!this.totalTrips || this.totalTrips === 0) return 0;
  return Math.round((this.totalAmountSpent || 0) / this.totalTrips);
});

// ✅ VIRTUAL: Spending tier
riderSchema.virtual('spendingTier').get(function () {
  const spent = this.totalAmountSpent || 0;
  if (spent >= 50000) return 'Premium'; // ₹50,000+
  if (spent >= 20000) return 'VIP'; // ₹20,000+
  if (spent >= 5000) return 'Regular'; // ₹5,000+
  return 'Starter';
});

// ✅ VIRTUAL: Full profile completion percentage
riderSchema.virtual('profileCompletion').get(function () {
  let completed = 0;
  const fields = [
    'name',
    'email',
    'phoneNo',
    'photo',
    'homeAddress',
    'workAddress',
    'emailVerified',
    'phoneVerified',
  ];

  fields.forEach((field) => {
    if (field === 'photo' && this.photo !== 'default-rider.jpg') completed++;
    else if (field === 'emailVerified' && this.emailVerified) completed++;
    else if (field === 'phoneVerified' && this.phoneVerified) completed++;
    else if (this[field]) completed++;
  });

  return Math.round((completed / fields.length) * 100);
});

// ✅ PASSWORD HASHING MIDDLEWARE
riderSchema.pre('save', async function (next) {
  // Only run if password was actually modified
  if (!this.isModified('password')) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // Delete passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

riderSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// ✅ HIDE INACTIVE USERS
riderSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

// ✅ INSTANCE METHODS
riderSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

riderSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

riderSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// ✅ REMOVED: updateTripStats method (now handled in controller)
// Stats are updated manually in the payment controller for better control

// ✅ INSTANCE METHOD: Get rider statistics
riderSchema.methods.getStats = function () {
  return {
    totalTrips: this.totalTrips || 0,
    totalAmountSpent: this.totalAmountSpent || 0,
    avgSpendingPerTrip: this.avgSpendingPerTrip,
    riderLevel: this.riderLevel,
    spendingTier: this.spendingTier,
    profileCompletion: this.profileCompletion,
    lastPaymentDate: this.lastPaymentDate,
    memberSince: this.createdAt,
  };
};

// ✅ INSTANCE METHOD: Check if eligible for promotions
riderSchema.methods.isEligibleForPromo = function (promoType) {
  switch (promoType) {
    case 'newbie':
      return this.totalTrips <= 3;
    case 'loyal':
      return this.totalTrips >= 20;
    case 'premium':
      return this.totalAmountSpent >= 10000;
    case 'inactive':
      return (
        this.lastPaymentDate &&
        Date.now() - this.lastPaymentDate.getTime() > 30 * 24 * 60 * 60 * 1000
      ); // 30 days
    default:
      return false;
  }
};

// ✅ STATIC METHODS
riderSchema.statics.getLeaderboard = async function (limit = 10) {
  return await this.find({ active: true })
    .sort({ totalTrips: -1, totalAmountSpent: -1 })
    .limit(limit)
    .select('name totalTrips totalAmountSpent averageRating')
    .lean();
};

riderSchema.statics.getStatistics = async function () {
  const stats = await this.aggregate([
    {
      $match: { active: true },
    },
    {
      $group: {
        _id: null,
        totalRiders: { $sum: 1 },
        totalTrips: { $sum: '$totalTrips' },
        totalRevenue: { $sum: '$totalAmountSpent' },
        avgTripsPerRider: { $avg: '$totalTrips' },
        avgSpendingPerRider: { $avg: '$totalAmountSpent' },
      },
    },
  ]);

  return (
    stats[0] || {
      totalRiders: 0,
      totalTrips: 0,
      totalRevenue: 0,
      avgTripsPerRider: 0,
      avgSpendingPerRider: 0,
    }
  );
};

// ✅ MODEL CREATION
let Rider;
try {
  Rider = mongoose.model('Rider');
} catch (error) {
  Rider = mongoose.model('Rider', riderSchema);
}

module.exports = Rider;
