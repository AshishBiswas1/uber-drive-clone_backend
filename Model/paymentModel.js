// Model/paymentModel.js
const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    // Uber-specific identifiers
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rider',
      required: [true, 'Rider ID is required'],
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: [true, 'Driver ID is required'],
      index: true,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: [true, 'Trip ID is required'],
      // ✅ REMOVED: index: true (because we have a unique index below)
    },

    // Legacy field for backward compatibility (optional)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'userModel',
      index: true,
    },
    userModel: {
      type: String,
      enum: ['Rider', 'Driver'],
    },

    // Stripe identifiers
    stripeSessionId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    stripeCustomerId: {
      type: String,
      index: true,
      sparse: true,
    },

    // Payment amounts (in smallest currency unit - paise for INR)
    amount: {
      type: Number,
      required: [true, 'Total payment amount is required'],
      min: [1, 'Amount must be at least 1 paise'],
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be an integer (paise for INR)',
      },
    },

    // Fare breakdown
    baseFare: {
      type: Number,
      required: [true, 'Base fare is required'],
      min: [0, 'Base fare cannot be negative'],
    },

    tipAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tip amount cannot be negative'],
    },

    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },

    // Platform economics
    platformFee: {
      type: Number,
      required: [true, 'Platform fee is required'],
      min: [0, 'Platform fee cannot be negative'],
    },

    driverEarnings: {
      type: Number,
      required: [true, 'Driver earnings amount is required'],
      min: [0, 'Driver earnings cannot be negative'],
    },

    // Currency
    currency: {
      type: String,
      required: true,
      default: 'inr',
      lowercase: true,
      enum: {
        values: ['inr', 'usd', 'eur', 'gbp'],
        message: '{VALUE} is not a supported currency',
      },
    },

    // Payment method and type
    paymentMethod: {
      type: String,
      enum: ['stripe', 'razorpay', 'wallet', 'cash', 'bank_transfer'],
      default: 'stripe',
    },

    type: {
      type: String,
      enum: ['trip_payment', 'tip', 'subscription', 'refund'],
      default: 'trip_payment',
    },

    // Session URLs
    sessionUrl: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || /^https:\/\/checkout\.stripe\.com\//.test(v);
        },
        message: 'Session URL must be a valid Stripe checkout URL',
      },
    },

    // Status tracking
    status: {
      type: String,
      enum: {
        values: [
          'created',
          'pending',
          'processing',
          'paid',
          'failed',
          'cancelled',
          'expired',
          'refunded',
          'partially_refunded',
        ],
        message: '{VALUE} is not a valid payment status',
      },
      default: 'created',
      index: true,
    },

    // Promo code information
    promoCode: {
      code: { type: String },
      discountAmount: { type: Number, default: 0 },
      discountPercentage: { type: Number, default: 0 },
    },

    // Arbitrary metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      validate: {
        validator: function (v) {
          return !v || JSON.stringify(v).length <= 2000;
        },
        message: 'Metadata cannot exceed 2000 characters when serialized',
      },
    },

    // Timestamps
    expiresAt: { type: Date },
    completedAt: { type: Date },
    failedAt: { type: Date },
    expiredAt: { type: Date },

    // Failure information
    failureReason: { type: String },

    // Refund information
    refundedAmount: {
      type: Number,
      default: 0,
      min: [0, 'Refunded amount cannot be negative'],
    },

    refundReason: { type: String },

    // Audit fields
    ipAddress: { type: String },
    userAgent: { type: String },

    // Payout information (for drivers)
    payoutStatus: {
      type: String,
      enum: ['pending', 'processing', 'paid', 'failed'],
      default: 'pending',
    },
    payoutId: { type: String }, // Stripe payout ID
    payoutDate: { type: Date },
  },
  {
    timestamps: true,
    versionKey: '__v',
  }
);

// **COMPOUND INDEXES for query performance**
PaymentSchema.index({ riderId: 1, status: 1 });
PaymentSchema.index({ driverId: 1, status: 1 });
PaymentSchema.index({ tripId: 1 }, { unique: true }); // ✅ One payment per trip - this is the only tripId index
PaymentSchema.index({ riderId: 1, createdAt: -1 });
PaymentSchema.index({ driverId: 1, createdAt: -1 });
PaymentSchema.index({ status: 1, createdAt: -1 });
PaymentSchema.index({ stripeSessionId: 1, status: 1 });
PaymentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for driver earnings queries
PaymentSchema.index({
  driverId: 1,
  status: 1,
  completedAt: -1,
});

// **PRE-SAVE MIDDLEWARE**
PaymentSchema.pre('save', function (next) {
  // Auto-lowercase currency
  if (this.currency) {
    this.currency = this.currency.toLowerCase();
  }

  // Set completion timestamp when status changes to paid
  if (
    this.isModified('status') &&
    this.status === 'paid' &&
    !this.completedAt
  ) {
    this.completedAt = new Date();
  }

  // Set failed timestamp when status changes to failed
  if (this.isModified('status') && this.status === 'failed' && !this.failedAt) {
    this.failedAt = new Date();
  }

  // Set expired timestamp when status changes to expired
  if (
    this.isModified('status') &&
    this.status === 'expired' &&
    !this.expiredAt
  ) {
    this.expiredAt = new Date();
  }

  // Validate amounts add up correctly
  const calculatedTotal = this.baseFare + this.tipAmount - this.discount;
  if (Math.abs(calculatedTotal - this.amount) > 1) {
    // Allow 1 paise difference for rounding
    const error = new Error(
      `Payment amount ${this.amount} does not match calculated total ${calculatedTotal}`
    );
    return next(error);
  }

  next();
});

// **PRE-VALIDATE MIDDLEWARE**
PaymentSchema.pre('validate', function (next) {
  // Ensure refunded amount doesn't exceed payment amount
  if (this.refundedAmount && this.refundedAmount > this.amount) {
    const error = new Error('Refunded amount cannot exceed payment amount');
    return next(error);
  }

  // Ensure driver earnings don't exceed reasonable bounds
  const maxDriverEarnings = this.baseFare + this.tipAmount;
  if (this.driverEarnings > maxDriverEarnings) {
    const error = new Error('Driver earnings cannot exceed base fare plus tip');
    return next(error);
  }

  next();
});

// **POST-SAVE MIDDLEWARE** for logging
PaymentSchema.post('save', function (doc, next) {
  if (this.isModified('status')) {
    console.log(
      `Payment ${doc._id} for trip ${doc.tripId} status changed to: ${doc.status}`
    );
  }
  next();
});

// **INSTANCE METHODS**
PaymentSchema.methods.isExpired = function () {
  return this.expiresAt && new Date() > this.expiresAt;
};

PaymentSchema.methods.canBeRefunded = function () {
  return this.status === 'paid' && this.refundedAmount < this.amount;
};

PaymentSchema.methods.getRemainingRefundAmount = function () {
  return this.status === 'paid' ? this.amount - this.refundedAmount : 0;
};

PaymentSchema.methods.getDriverNet = function () {
  // Calculate what driver actually receives after platform fee
  return this.driverEarnings;
};

PaymentSchema.methods.getPlatformRevenue = function () {
  // Platform keeps the platform fee
  return this.platformFee;
};

// **STATIC METHODS** for common queries
PaymentSchema.statics.findByRider = function (riderId, options = {}) {
  const query = this.find({ riderId });

  if (options.status) {
    query.where('status').equals(options.status);
  }

  if (options.limit) {
    query.limit(options.limit);
  }

  return query.sort({ createdAt: -1 });
};

PaymentSchema.statics.findByDriver = function (driverId, options = {}) {
  const query = this.find({ driverId });

  if (options.status) {
    query.where('status').equals(options.status);
  }

  if (options.limit) {
    query.limit(options.limit);
  }

  return query.sort({ createdAt: -1 });
};

PaymentSchema.statics.getDriverEarnings = function (
  driverId,
  startDate,
  endDate
) {
  const matchStage = {
    driverId: new mongoose.Types.ObjectId(driverId),
    status: 'paid',
  };

  if (startDate || endDate) {
    matchStage.completedAt = {};
    if (startDate) matchStage.completedAt.$gte = startDate;
    if (endDate) matchStage.completedAt.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalEarnings: { $sum: '$driverEarnings' },
        totalTrips: { $sum: 1 },
        totalTips: { $sum: '$tipAmount' },
        avgEarningsPerTrip: { $avg: '$driverEarnings' },
      },
    },
  ]);
};

PaymentSchema.statics.getPlatformRevenue = function (startDate, endDate) {
  const matchStage = { status: 'paid' };

  if (startDate || endDate) {
    matchStage.completedAt = {};
    if (startDate) matchStage.completedAt.$gte = startDate;
    if (endDate) matchStage.completedAt.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$platformFee' },
        totalGrossRevenue: { $sum: '$amount' },
        totalPayments: { $sum: 1 },
        avgPayment: { $avg: '$amount' },
      },
    },
  ]);
};

// **VIRTUAL FIELDS**
PaymentSchema.virtual('amountFormatted').get(function () {
  if (this.currency === 'inr') {
    return `₹${(this.amount / 100).toFixed(2)}`;
  } else if (this.currency === 'usd') {
    return `$${(this.amount / 100).toFixed(2)}`;
  }
  return `${(this.amount / 100).toFixed(2)} ${this.currency.toUpperCase()}`;
});

PaymentSchema.virtual('isPaid').get(function () {
  return this.status === 'paid';
});

PaymentSchema.virtual('isProcessing').get(function () {
  return ['created', 'pending', 'processing'].includes(this.status);
});

// Ensure virtuals are included in JSON output
PaymentSchema.set('toJSON', { virtuals: true });
PaymentSchema.set('toObject', { virtuals: true });

const Payment = mongoose.model('Payment', PaymentSchema);

module.exports = Payment;
