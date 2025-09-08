const Rider = require('./../Model/riderModel');
const catchAsync = require('./../util/catchAsync');
const AppError = require('./../util/appError');

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
