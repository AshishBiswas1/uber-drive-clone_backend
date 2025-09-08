const AppError = require('./appError');

const calculateDistance = (coords1, coords2) => {
  try {
    // Validate input parameters
    if (
      !coords1 ||
      !coords2 ||
      !Array.isArray(coords1) ||
      !Array.isArray(coords2)
    ) {
      throw new AppError(
        'Invalid coordinates provided. Expected arrays with [lng, lat]',
        400
      );
    }

    if (coords1.length !== 2 || coords2.length !== 2) {
      throw new AppError(
        'Coordinates must contain exactly 2 values [lng, lat]',
        400
      );
    }

    const [lng1, lat1] = coords1;
    const [lng2, lat2] = coords2;

    // Validate coordinate values
    if (isNaN(lng1) || isNaN(lat1) || isNaN(lng2) || isNaN(lat2)) {
      throw new AppError('Coordinates must be valid numbers', 400);
    }

    // Check coordinate ranges
    if (Math.abs(lat1) > 90 || Math.abs(lat2) > 90) {
      throw new AppError('Latitude must be between -90 and 90 degrees', 400);
    }

    if (Math.abs(lng1) > 180 || Math.abs(lng2) > 180) {
      throw new AppError('Longitude must be between -180 and 180 degrees', 400);
    }

    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;

    // Validate result
    if (isNaN(distance) || distance < 0) {
      throw new AppError('Failed to calculate valid distance', 500);
    }

    return distance;
  } catch (error) {
    // If it's already an AppError, re-throw it
    if (error instanceof AppError) {
      throw error;
    }
    // For unexpected errors, wrap in AppError
    throw new AppError(`Distance calculation failed: ${error.message}`, 500);
  }
};

const formatDriversWithDistance = (drivers, userCoords) => {
  try {
    // Validate input parameters
    if (!drivers) {
      throw new AppError('Drivers array is required', 400);
    }

    if (!Array.isArray(drivers)) {
      throw new AppError('Drivers must be an array', 400);
    }

    if (!userCoords || !Array.isArray(userCoords)) {
      throw new AppError(
        'User coordinates are required and must be an array',
        400
      );
    }

    if (userCoords.length !== 2) {
      throw new AppError(
        'User coordinates must contain exactly [lng, lat]',
        400
      );
    }

    // If drivers array is empty, return empty array
    if (drivers.length === 0) {
      return [];
    }

    return drivers.map((driver, index) => {
      try {
        // Validate individual driver object
        if (!driver || typeof driver !== 'object') {
          throw new AppError(`Invalid driver object at index ${index}`, 400);
        }

        if (!driver._id) {
          throw new AppError(`Driver at index ${index} is missing _id`, 400);
        }

        if (!driver.currentLocation || !driver.currentLocation.coordinates) {
          throw new AppError(
            `Driver at index ${index} is missing location coordinates`,
            400
          );
        }

        if (!Array.isArray(driver.currentLocation.coordinates)) {
          throw new AppError(
            `Driver at index ${index} has invalid coordinates format`,
            400
          );
        }

        // Calculate distance
        const distanceKm = calculateDistance(
          userCoords,
          driver.currentLocation.coordinates
        );

        // Format and return driver data
        return {
          id: driver._id,
          name: driver.name || 'Unknown',
          photo: driver.photo || 'default-driver.jpg',
          phoneNo: driver.phoneNo || 'N/A',
          licenceNo: driver.licenceNo || 'N/A',
          vehicleType: `${driver.vehicle?.make || 'Unknown'} ${
            driver.vehicle?.model || 'Vehicle'
          }`,
          vehiclePlate: driver.vehicle?.licensePlate || 'N/A',
          status: driver.status || 'offline',
          totalTrips: Number(driver.totalTrips) || 0,
          acceptanceRate: Number(driver.acceptanceRate) || 0,
          distanceKm: Number(distanceKm.toFixed(2)),
        };
      } catch (error) {
        // If it's an AppError from calculateDistance or validation, re-throw
        if (error instanceof AppError) {
          throw error;
        }
        // For unexpected errors in driver processing
        throw new AppError(
          `Error processing driver at index ${index}: ${error.message}`,
          500
        );
      }
    });
  } catch (error) {
    // If it's already an AppError, re-throw it
    if (error instanceof AppError) {
      throw error;
    }
    // For unexpected errors in the main function
    throw new AppError(
      `Failed to format drivers with distance: ${error.message}`,
      500
    );
  }
};

module.exports = {
  calculateDistance,
  formatDriversWithDistance,
};
