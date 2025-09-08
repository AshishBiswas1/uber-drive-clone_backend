const express = require('express');
const driverController = require('./../Controller/driverController');

const router = express.Router();

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
