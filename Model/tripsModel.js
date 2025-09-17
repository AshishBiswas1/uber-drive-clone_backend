const mongoose = require('mongoose');

const tripSchema = mongoose.Schema(
  {
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rider',
      required: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null,
    },
    pickupLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
    },
    stops: [
      {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
        },
        coordinates: {
          type: [Number],
          required: true,
        },
        address: {
          type: String,
          required: true,
        },
      },
    ],
    dropoffLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
    },
    status: {
      type: String,
      enum: [
        'requested',
        'driver_assigned',
        'driver_arriving',
        'driver_arrived',
        'trip_started',
        'completed',
        'cancelled_by_rider',
        'cancelled_by_driver',
        'no_show',
      ],
      default: 'requested',
    },
    vehicleType: {
      type: String,
      enum: ['Sedan', 'SUV', 'Van'],
      required: true,
    },
    fare: {
      baseFare: {
        type: Number,
        default: 0,
      },
      distanceFare: {
        type: Number,
        default: 0,
      },
      timeFare: {
        type: Number,
        default: 0,
      },
      surgePricing: {
        type: Number,
        default: 1.0,
      },
      totalFare: {
        type: Number,
        default: 0,
      },
      currency: {
        type: String,
        default: 'Rupees',
      },
    },
    distance: {
      type: Number, // in kilometers
      default: 0,
    },
    duration: {
      estimatedDuration: {
        type: Number, // in minutes
        default: 0,
      },
      actualDuration: {
        type: Number, // in minutes
        default: 0,
      },
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    driverAssignedAt: {
      type: Date,
      default: null,
    },
    driverArrivedAt: {
      type: Date,
      default: null,
    },
    tripStartedAt: {
      type: Date,
      default: null,
    },
    tripCompletedAt: {
      type: Date,
      default: null,
    },
    route: [
      {
        timestamp: { type: Date, required: true, default: Date.now },
        coordinates: {
          type: [Number], // [lng, lat]
          required: true,
          validate: {
            validator: function (v) {
              return (
                Array.isArray(v) &&
                v.length === 2 &&
                typeof v[0] === 'number' &&
                typeof v[1] === 'number' &&
                v[0] >= -180 &&
                v[0] <= 180 &&
                v[1] >= -90 &&
                v[1] <= 90
              );
            },
            message: 'coordinates must be [lng, lat] within valid ranges',
          },
        },
      },
    ],
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

tripSchema.index({ pickupLocation: '2dsphere' });
tripSchema.index({ dropoffLocation: '2dsphere' });
tripSchema.index({ 'route.coordinates': '2dsphere' }); // optional

tripSchema.index({ riderId: 1, status: 1 });
tripSchema.index({ driverId: 1, status: 1 });
tripSchema.index({ status: 1, requestedAt: -1 });

const Trip = mongoose.model('Trip', tripSchema);
module.exports = Trip;
