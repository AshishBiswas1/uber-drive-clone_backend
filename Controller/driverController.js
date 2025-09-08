const Driver = require('./../Model/driverModel');
const catchAsync = require('./../util/catchAsync');
const AppError = require('./../util/appError');

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
