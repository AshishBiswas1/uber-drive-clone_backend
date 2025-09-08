const Rider = require('./../Model/riderModel');
const catchAsync = require('./../util/catchAsync');
const AppError = require('./../util/appError');
const { formatDriversWithDistance } = require('./../util/DriverFinding');
const Driver = require('./../Model/driverModel');

exports.getAllRiders = catchAsync(async (req, res, next) => {
  const riders = await Rider.find();

  res.status(200).json({
    status: 'success',
    results: riders.length,
    data: {
      riders,
    },
  });
});

exports.getRider = catchAsync(async (req, res, next) => {
  const rider = await Rider.findById(req.params.id);

  if (!rider) {
    return next(new AppError('No rider found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      rider,
    },
  });
});

exports.createRider = catchAsync(async (req, res, next) => {
  const rider = await Rider.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      rider,
    },
  });
});

exports.updateRider = catchAsync(async (req, res, next) => {
  const rider = await Rider.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!rider) {
    return next(new AppError('No rider found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      rider,
    },
  });
});

exports.deleteRider = catchAsync(async (req, res, next) => {
  const rider = await Rider.findByIdAndDelete(req.params.id);

  if (!rider) {
    next(new AppError('No rider found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.getNearbyDrivers = catchAsync(async (req, res, next) => {
  const { lat, lng } = req.query;

  if (!lng || !lat) {
    return next(
      new AppError('Please provide both lng and lat query parameters', 400)
    );
  }

  const longitude = parseFloat(lng);
  const latitude = parseFloat(lat);

  const maxDistance = 5000;

  const drivers = await Driver.find({
    status: 'online',
    approvalStatus: 'approved',
    isActive: true,
    currentLocation: {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: maxDistance,
      },
    },
  })
    .select(
      'name photo phoneNo licenceNo vehicle status currentLocation totalTrips acceptanceRate'
    )
    .lean();

  const driversWithDistance = formatDriversWithDistance(drivers, [
    longitude,
    latitude,
  ]);

  // Sort by distance (closest first)
  driversWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

  res.status(200).json({
    status: 'success',
    results: driversWithDistance.length,
    data: {
      drivers: driversWithDistance,
    },
  });
});
