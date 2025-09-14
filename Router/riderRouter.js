const express = require('express');
const riderController = require('./../Controller/riderController');
const authController = require('./../Controller/authController');
const Rider = require('./../Model/riderModel');

const router = express.Router();

// For login and signup
router.route('/signup').post(authController.signup(Rider));
router.route('/login').post(authController.login(Rider));

// For password Reset
router.route('/forgetPassword').post(authController.forgetPassword(Rider));
router
  .route('/resetPassword/:token')
  .patch(authController.resetPassword(Rider));

router.use(authController.protect);
router
  .route('/getDriver')
  .get(authController.restrictTo('rider'), riderController.getNearbyDrivers);

router.use(authController.restrictTo('admin'));

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
