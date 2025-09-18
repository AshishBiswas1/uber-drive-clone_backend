const Rider = require('./../Model/riderModel');
const catchAsync = require('./../util/catchAsync');
const AppError = require('./../util/appError');
const { formatDriversWithDistance } = require('./../util/DriverFinding');
const Driver = require('./../Model/driverModel');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

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
      '_id name photo phoneNo licenceNo vehicle status currentLocation totalTrips acceptanceRate' // ✅ FIXED: Use _id instead of id
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

exports.getMe = catchAsync(async (req, res, next) => {
  req.params.id = req.user.id;
  next();
});

exports.updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.passwordConfirm) {
    return next(new AppError('This route is not for password updates', 400));
  }
  const filteredBody = filterObj(req.body, 'name', 'email', 'phoneNo');
  if (req.file) filteredBody.photo = req.file.filename;

  const updatedUser = await Rider.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await Rider.findByIdAndUpdate(req.user.id, { isActive: false });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
