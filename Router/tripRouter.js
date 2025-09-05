const express = require('express');
const tripController = require('./../Controller/tripController');

const router = express.Router();
router.route('/nearby').get(tripController.getNearByTrips);

router.route('/:id/status').patch(tripController.updateTripStatus);

router.route('/:id/cancel').patch(tripController.cancelTrip);

router
   .route('/')
   .get(tripController.getAllTrips)
   .post(tripController.createTrip);

router
   .route('/:id')
   .get(tripController.getTrip)
   .patch(tripController.updateTrip)
   .delete(tripController.deleteTrip);

module.exports = router;
