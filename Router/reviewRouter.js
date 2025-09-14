const express = require('express');
const reviewController = require('./../Controller/reviewController');
const authController = require('./../Controller/authController');

const router = express.Router();

// Public routes (before protect middleware)
router.route('/driver/:driverId').get(reviewController.getDriverReviews);

// Add this line to reviewRoutes.js
router.route('/top-reviews').get(reviewController.getTopReviews);

router.use(authController.protect);

router.route('/my-reviews').get(reviewController.getRiderReviews);

router.route('/trip/:tripId').post(reviewController.createRiderReview);

router.route('/:reviewId/helpful').patch(reviewController.markReviewHelpful);

router.route('/:reviewId/report').patch(reviewController.reportReview);

router
  .route('/:reviewId/response')
  .patch(
    authController.restrictTo('driver'),
    reviewController.addDriverResponse
  );

router
  .route('/statistics')
  .get(authController.restrictTo('admin'), reviewController.getReviewsStats);

router
  .route('/')
  .get(authController.restrictTo('admin'), reviewController.getAllReviews)
  .post(authController.restrictTo('admin'), reviewController.createReview);

router
  .route('/:id')
  .get(authController.restrictTo('admin'), reviewController.getReview)
  .patch(authController.restrictTo('rider'), reviewController.updateRiderReview)
  .delete(reviewController.deleteReview);

router
  .route('/:id/status')
  .patch(
    authController.restrictTo('admin'),
    reviewController.updateReviewStatus
  );

module.exports = router;
