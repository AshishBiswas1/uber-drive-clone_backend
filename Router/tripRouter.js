const express = require('express');
const tripController = require('./../Controller/tripController');

const router = express.Router();

router
 .route('/')
 .get(tripController.getAllTrips)
 .post(tripController.createTrip);

module.exports = router;
