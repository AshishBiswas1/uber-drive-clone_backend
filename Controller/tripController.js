const Trip = require('./../Model/tripsModel');
const catchAsync = require('./../util/catchAsync');
const AppError = require('./../util/appError');
const FareService = require('./../service/service');

exports.getAllTrips = catchAsync(async (req, res, next) => {
  const trips = await Trip.find();

  res.status(200).json({
    status: 'success',
    results: trips.length,
    data: {
      trips,
    },
  });
});

exports.getTrip = catchAsync(async (req, res, next) => {
  const trip = await Trip.findById(req.params.id);

  if (!trip) {
    return next(new AppError('No trip found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      trip,
    },
  });
});

exports.createTrip = catchAsync(async (req, res, next) => {
  const newTrip = await Trip.create({
    riderId: req.body.riderId,
    driverId: req.body.driverId,
    pickupLocation: req.body.pickupLocation,
    dropoffLocation: req.body.dropoffLocation,
    status: req.body.status,
    vehicleType: req.body.vehicleType,
    fare: req.body.fare,
    distance: req.body.distance,
    duration: req.body.duration,
  });

  res.status(201).json({
    status: 'success',
    data: {
      trip: {
        newTrip,
      },
    },
  });
});

exports.updateTrip = catchAsync(async (req, res, next) => {
  const trip = await Trip.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!trip) {
    return next(new AppError('No trip found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      trip,
    },
  });
});

exports.deleteTrip = catchAsync(async (req, res, next) => {
  const trip = await Trip.findByIdAndDelete(req.params.id);

  if (!trip) {
    next(new AppError('No trip found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.updateTripStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  const trip = await Trip.findByIdAndUpdate(
    req.params.id,
    {
      status,
      [`${status}At`]: new Date(),
    },
    { new: true }
  );

  res.status(200).json({
    status: 'success',
    data: {
      trip,
    },
  });
});

exports.cancelTrip = catchAsync(async (req, res, next) => {
  const { cancelledBy } = req.body;

  const trip = await Trip.findByIdAndUpdate(
    req.params.id,
    {
      status: `cancelled_By_${cancelledBy}`,
      tripCompletedAt: new Date(),
    },
    {
      new: true,
    }
  );

  if (!trip) {
    return next(new AppError('No trip found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      trip,
    },
  });
});

exports.getNearByTrips = catchAsync(async (req, res, next) => {
  const { lng, lat, maxDistance } = req.query;

  const trips = await Trip.find({
    status: 'requested',
    pickupLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1],
        },
        $maxDistance: maxDistance * 1000,
      },
    },
  });

  res.status(200).json({
    status: 'success',
    results: trips.length,
    data: {
      trips,
    },
  });
});

exports.updateTripRoute = catchAsync(async (req, res, next) => {
  const { coordinates } = req.body;

  const trip = await Trip.findByIdAndUpdate(
    req.params.id,
    {
      $push: {
        route: {
          timestamp: new Date(),
          coordinates,
        },
      },
    },
    { new: true }
  );

  if (!trip) {
    return next(new AppError('No trip found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { trip },
  });
});

exports.getTripAnalytics = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  const analytics = await Trip.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$fare.totalFare' },
        avgDistance: { $avg: '$distance' },
        avgDuration: { $avg: '$duration.actualDuration' },
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: { analytics },
  });
});

exports.calculateFareEstimate = catchAsync(async (req, res, next) => {
  const { pickupLocation, dropoffLocation, vehicleType } = req.body;

  if (!pickupLocation || !dropoffLocation || !vehicleType) {
    return next(new AppError('Missing required fields', 400));
  }

  try {
    const fareData = FareService.calculateFareEstimate(
      pickupLocation,
      dropoffLocation,
      vehicleType
    );

    res.status(200).json({
      status: 'success',
      data: fareData,
    });
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});
