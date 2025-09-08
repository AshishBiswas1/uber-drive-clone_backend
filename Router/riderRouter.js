const express = require('express');
const riderController = require('./../Controller/riderController');

const router = express.Router();

router.route('/getDriver').get(riderController.getNearbyDrivers);

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
