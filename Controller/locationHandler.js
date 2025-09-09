const axios = require('axios');
const catchAsync = require('./../util/catchAsync');
const AppError = require('./../util/appError');

exports.getCurrentLocation = catchAsync(async (req, res, next) => {
  const apiKey = process.env.GEOAPIFY_API_KEY;

  const response = await axios.get('https://api.geoapify.com/v1/ipinfo', {
    params: { apiKey },
  });

  if (!response.data || !response.data.location) {
    return next(new AppError('Could not detect user location', 400));
  }

  const location = response.data.location;

  res.status(200).json({
    status: 'success',
    message: 'Current location retrieved successfully',
    data: {
      latitude: location.latitude,
      longitude: location.longitude,
      city: location.city,
      country: location.country_name,
      accuracy: 'city-level',
    },
  });
});
