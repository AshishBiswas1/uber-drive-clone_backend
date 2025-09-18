const Driver = require('./../Model/driverModel');
const catchAsync = require('./../util/catchAsync');
const AppError = require('./../util/appError');
const Trip = require('./../Model/tripsModel');

exports.getAllDrivers = catchAsync(async (req, res, next) => {
  const drivers = await Driver.find();

  res.status(200).json({
    status: 'success',
    results: drivers.length,
    data: {
      drivers,
    },
  });
});

exports.getDriver = catchAsync(async (req, res, next) => {
  const driver = await Driver.findById(req.params.id);

  if (!driver) {
    return next(new AppError('No driver found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      driver,
    },
  });
});

exports.createDriver = catchAsync(async (req, res, next) => {
  const driver = await Driver.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      driver,
    },
  });
});

exports.updateDriver = catchAsync(async (req, res, next) => {
  const driver = await Driver.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!driver) {
    return next(new AppError('No driver found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      driver,
    },
  });
});

exports.deleteDriver = catchAsync(async (req, res, next) => {
  const driver = await Driver.findByIdAndDelete(req.params.id);

  if (!driver) {
    next(new AppError('No driver found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.assignDriver = catchAsync(async (req, res, next) => {
  const { driverId } = req.body;

  const trip = await Trip.findByIdAndUpdate(
    req.params.id,
    {
      driverId,
      status: 'driver_assigned',
      driverAssignedAt: new Date(),
    },
    { new: true }
  ).populate('driverId riderId', 'name phone');

  // Send notifications to rider and driver
  // sendNotification(trip.riderId, 'Driver assigned');
  // sendNotification(driverId, 'New trip assigned');

  res.status(200).json({
    status: 'success',
    data: { trip },
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

  const updatedUser = await Driver.findByIdAndUpdate(
    req.user.id,
    filteredBody,
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await Driver.findByIdAndUpdate(req.user.id, { isActive: false });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.setCurrentLocation = catchAsync(async (req, res, next) => {
  const { longitude, latitude } = req.body;

  if (!longitude || !latitude) {
    return next(
      new AppError('Please provide both lng and lat query parameters', 400)
    );
  }

  const driver = await Driver.findByIdAndUpdate(
    req.user.id,
    {
      currentLocation: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      driver,
    },
  });
});

exports.setDriverStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  const driver = await Driver.findByIdAndUpdate(
    req.user.id,
    {
      status,
    },
    { new: true }
  );

  res.status(200).json({
    status: 'success',
    data: {
      driver,
    },
  });
});

exports.getRequestedRides = catchAsync(async (req, res, next) => {
  const trips = await Trip.find({ driverId: req.user.id, status: 'requested' });

  res.status(200).json({
    status: 'success',
    results: trips.length,
    data: {
      trips,
    },
  });
});
