const express = require('express');
const reviewController = require('./../Controller/reviewController');
const authController = require('./../Controller/authController');

const router = express.Router();

// ===========================================
// PUBLIC ROUTES
// ===========================================
// Accessible to anyone. Placed before any authentication middleware.
router.get('/top-reviews', reviewController.getTopReviews);
router.get('/driver/:driverId', reviewController.getDriverReviews);

// ===========================================
// AUTHENTICATION MIDDLEWARE
// ===========================================
// All routes below this line are protected and require a logged-in user.
router.use(authController.protect);

// ===========================================
// GENERAL & SPECIFIC ROUTES (Authenticated)
// ===========================================
// Specific, static routes are placed before generic routes like '/:id' to avoid conflicts.

router.get(
  '/my-reviews',
  authController.restrictTo('rider', 'admin', 'Admin'),
  reviewController.getRiderReviews
);

router.get(
  '/statistics',
  authController.restrictTo('admin'),
  reviewController.getReviewsStats
);

// Admin route for getting all reviews.
router.get(
  '/',
  authController.restrictTo('admin'),
  reviewController.getAllReviews
);

// This route for creating a review is more specific than the generic POST for admin.
router.post(
  '/trip/:tripId',
  authController.restrictTo('rider'),
  reviewController.createRiderReview
);

// ===========================================
// ROUTES FOR A SPECIFIC REVIEW ('/:id')
// ===========================================
// These routes operate on a specific review identified by its ID.

router.get('/:id', reviewController.getReview); // Allows any authenticated user to get a review by ID.

// Rider can update their own review.
router.patch(
  '/:id',
  authController.restrictTo('rider'),
  reviewController.updateRiderReview
);

// Any authenticated user can mark a review as helpful or report it.
router.patch('/:id/helpful', reviewController.markReviewHelpful);
router.patch('/:id/report', reviewController.reportReview);

// A driver can respond to a review about them.
router.patch(
  '/:id/response',
  authController.restrictTo('driver'),
  reviewController.addDriverResponse
);

// ===========================================
// ADMIN-ONLY ACTIONS
// ===========================================
// These routes provide admins with full control over reviews.

// Admin can create a review manually.
router.post(
  '/',
  authController.restrictTo('admin'),
  reviewController.createReview
);

// Admin has full update and delete permissions on any review.
router.patch(
  '/:id',
  authController.restrictTo('admin'),
  reviewController.updateReview
);

router.patch(
  '/status/:id',
  authController.restrictTo('admin'),
  reviewController.updateReviewStatus
);

router.delete(
  '/:id',
  authController.restrictTo('admin'),
  reviewController.deleteReview
);

module.exports = router;
