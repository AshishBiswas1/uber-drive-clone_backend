const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
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
    enum: ['rider'],
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

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// MIDDLEWARE

// Hash password before saving
riderSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
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

const Rider = mongoose.model('Rider', riderSchema);
module.exports = Rider;
