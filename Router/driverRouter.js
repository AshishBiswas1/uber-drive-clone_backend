const express = require('express');
const driverController = require('./../Controller/driverController');
const authController = require('./../Controller/authController');
const Driver = require('./../Model/driverModel');

const router = express.Router();
// Signup and login
router.route('/signup').post(authController.signup(Driver));
router.route('/login').post(authController.login(Driver));
router.route('/assign-driver/:id').post(driverController.assignDriver);

// Password Reset
router.route('/forgetPassword').post(authController.forgetPassword(Driver));
router
  .route('/resetPassword/:token')
  .patch(authController.resetPassword(Driver));

router.use(authController.protect, authController.restrictTo('admin'));

router
  .route('/')
  .get(driverController.getAllDrivers)
  .post(driverController.createDriver);

router
  .route('/:id')
  .get(driverController.getDriver)
  .patch(driverController.updateDriver)
  .delete(driverController.deleteDriver);

module.exports = router;
