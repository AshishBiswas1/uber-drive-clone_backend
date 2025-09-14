const express = require('express');
const tripController = require('./../Controller/tripController');
const authController = require('./../Controller/authController');

const router = express.Router();

router.use(authController.protect);

router.route('/nearby').get(tripController.getNearByTrips);

router.route('/:id/status').patch(tripController.updateTripStatus);

router.route('/:id/cancel').patch(tripController.cancelTrip);

router.route('/:id/route').patch(tripController.updateTripRoute);

router.route('/analytics').get(tripController.getTripAnalytics);

router.route('/fare-estimate').post(tripController.calculateFareEstimate);

router
  .route('/')
  .get(tripController.getAllTrips)
  .post(authController.restrictTo('admin'), tripController.createTrip);

router
  .route('/:id')
  .get(authController.restrictTo('driver'), tripController.getTrip)
  .patch(authController.restrictTo('admin'), tripController.updateTrip)
  .delete(tripController.deleteTrip);

module.exports = router;
