const express = require('express');
const riderController = require('./../Controller/riderController');
const authController = require('./../Controller/authController');
const Rider = require('./../Model/riderModel');

const router = express.Router();

router.route('/getDriver').get(riderController.getNearbyDrivers);

router.route('/signup').post(authController.signup(Rider));

router
  .route('/')
  .get(riderController.getAllRiders)
  .post(riderController.createRider);

router
  .route('/:id')
  .get(riderController.getRider)
  .patch(riderController.updateRider)
  .delete(riderController.deleteRider);

module.exports = router;
