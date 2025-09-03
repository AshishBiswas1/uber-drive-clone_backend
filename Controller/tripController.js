const Trip = require('./../Model/tripsModel');
const catchAsync = require('./../util/catchAsync');
const AppError = require('./../util/appError');

exports.getAllTrips = catchAsync(async (req, res) => {
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

exports.createTrip = catchAsync(async (req, res) => {
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
