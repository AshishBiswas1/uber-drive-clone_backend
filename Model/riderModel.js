const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const validator = require('validator');

const riderSchema = new mongoose.Schema({
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

  // Profile
  photo: {
    type: String,
    default: 'default-rider.jpg',
  },
  role: {
    type: String,
    enum: ['rider', 'admin'],
    default: 'rider',
  },

  // Status
  isActive: {
    type: Boolean,
    default: true,
  },

  // Performance Metrics
  totalRides: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },

  // Timestamps & Password Reset Fields
  createdAt: {
    type: Date,
    default: Date.now,
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
});

// MIDDLEWARE

// Hash password before saving
riderSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // Delete passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

// Set passwordChangedAt when password is modified
riderSchema.pre('save', function (next) {
  // Only run if password was modified and it's not a new document
  if (!this.isModified('password') || this.isNew) return next();

  // Set passwordChangedAt to current time (minus 1 second to ensure JWT is created after)
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// INSTANCE METHODS

// Check if password is correct
riderSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Check if password was changed after JWT token was issued
riderSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    // Return true if password was changed after token was issued
    return JWTTimestamp < changedTimestamp;
  }

  // False means password was NOT changed
  return false;
};

// Generate password reset token
riderSchema.methods.createPasswordResetToken = function () {
  // Generate random token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash token and save to database
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set token expiration (10 minutes)
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  // Return unhashed token (to be sent via email)
  return resetToken;
};

const Rider = mongoose.model('Rider', riderSchema);
module.exports = Rider;
