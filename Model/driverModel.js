const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const crypto = require('crypto');

const driverSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Please tell us your name!'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  phoneNo: {
    type: String,
    required: [true, 'Please provide your phone number'],
    unique: true,
    validate: {
      validator: function (v) {
        return /^\+?[1-9]\d{1,14}$/.test(v);
      },
      message: 'Please provide a valid phone number',
    },
  },

  // Authentication Fields
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      validator: function (el) {
        return el === this.password;
      },
      message: 'Passwords are not the same!',
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,

  // Profile & Role
  photo: {
    type: String,
    default: 'default-avatar.png',
  },
  role: {
    type: String,
    enum: ['driver'],
    default: 'driver',
  },

  // Driver License & Verification
  licenceNo: {
    type: String,
    required: [true, 'Please provide your license number'],
    unique: true,
    trim: true,
    select: false,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
    select: false,
  },

  // Additional Driver Fields
  dateOfBirth: {
    type: Date,
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'India' },
  },

  // Simplified Vehicle Information
  vehicle: {
    make: {
      type: String,
    },
    model: {
      type: String,
    },
    licensePlate: {
      type: String,
      unique: true,
      sparse: true, // Allow null values without unique constraint conflict
    },
  },

  // Driver Status & Location
  status: {
    type: String,
    enum: ['offline', 'online', 'busy', 'break'],
    default: 'offline',
  },
  // ✅ FIXED: Proper GeoJSON schema - completely optional
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      // No default value
    },
    coordinates: {
      type: [Number],
      // No default value
      validate: {
        validator: function (v) {
          return (
            !v ||
            (Array.isArray(v) &&
              v.length === 2 &&
              v.every((coord) => typeof coord === 'number' && !isNaN(coord)))
          );
        },
        message:
          'Coordinates must be an array of exactly 2 valid numbers [longitude, latitude]',
      },
    },
    // ❌ REMOVED: Don't use required: false and index: false here
  },

  // Performance Metrics (Simplified)
  totalTrips: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  acceptanceRate: { type: Number, default: 0 },
  cancellationRate: { type: Number, default: 0 },

  // Emergency Contact
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String,
  },
  vechileType: {
    type: String,
    enum: ['Sedan', 'SUV', 'Van'],
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: Date,
  lastActiveAt: Date,
});

// INDEXES - Create partial index to only index documents with valid currentLocation
driverSchema.index(
  { currentLocation: '2dsphere' },
  {
    partialFilterExpression: {
      'currentLocation.coordinates': { $exists: true, $ne: null },
    },
  }
);
driverSchema.index({ status: 1 });

// MIDDLEWARE

// Clean up incomplete currentLocation before saving
driverSchema.pre('save', function (next) {
  // Remove incomplete currentLocation objects
  if (
    this.currentLocation &&
    (!this.currentLocation.type ||
      !this.currentLocation.coordinates ||
      !Array.isArray(this.currentLocation.coordinates) ||
      this.currentLocation.coordinates.length !== 2)
  ) {
    this.currentLocation = undefined;
  }
  next();
});

// Hash license number before saving
driverSchema.pre('save', async function (next) {
  if (!this.isModified('licenceNo')) return next();

  try {
    this.licenceNo = await bcrypt.hash(this.licenceNo, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// Hash password before saving
driverSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
  next();
});

// Update passwordChangedAt property
driverSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Update the updatedAt field before saving
driverSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// INSTANCE METHODS

// Check if password is correct
driverSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Check if license number is correct (for verification purposes)
driverSchema.methods.correctLicenceNo = async function (
  candidateLicenceNo,
  userLicenceNo
) {
  return await bcrypt.compare(candidateLicenceNo, userLicenceNo);
};

// Check if password was changed after JWT was issued
driverSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Create password reset token
driverSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Method to safely set driver location
driverSchema.methods.setCurrentLocation = function (longitude, latitude) {
  if (
    typeof longitude === 'number' &&
    typeof latitude === 'number' &&
    !isNaN(longitude) &&
    !isNaN(latitude)
  ) {
    this.currentLocation = {
      type: 'Point',
      coordinates: [longitude, latitude],
    };
    return true;
  }
  return false;
};

// QUERY MIDDLEWARE

// Exclude inactive drivers from queries
driverSchema.pre(/^find/, function (next) {
  this.find({ isActive: { $ne: false } });
  next();
});

const Driver = mongoose.model('Driver', driverSchema);
module.exports = Driver;
