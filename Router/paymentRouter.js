// routes/paymentRoutes.js - COMPLETE WITH ENHANCED SUCCESS ROUTE
const express = require('express');
const router = express.Router();
const paymentController = require('../Controller/paymentController');
const authController = require('../Controller/authController');

// ===========================================
// PUBLIC ROUTES
// ===========================================
// Webhook must be placed before any middleware that parses JSON
// RAW body for webhook signature verification
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.webhook
);

// ✅ NEW: Public success and cancel routes (no auth required for frontend redirects)
router.get('/success', paymentController.paymentSuccess);
router.get('/cancel', paymentController.paymentCancel);
router.get('/return', paymentController.paymentReturn);

// ===========================================
// AUTHENTICATION MIDDLEWARE
// ===========================================
// All routes below require authentication
router.use(authController.protect);

// ===========================================
// PAYMENT SESSION ROUTES
// ===========================================
// Create checkout session for trip payment (Riders only)
router.post(
  '/create-session',
  authController.restrictTo('rider'),
  paymentController.createCheckoutSession
);

// Create payment intent for immediate payment (Riders only)
router.post(
  '/create-payment-intent',
  authController.restrictTo('rider'),
  paymentController.createPaymentIntent
);

// Confirm payment intent (Riders only)
router.post(
  '/confirm-payment/:paymentIntentId',
  authController.restrictTo('rider'),
  paymentController.confirmPayment
);

// ===========================================
// PAYMENT METHODS ROUTES (Riders only)
// ===========================================
// Get user's saved payment methods
router.get(
  '/payment-methods',
  authController.restrictTo('rider'),
  paymentController.getPaymentMethods
);

// Add new payment method
router.post(
  '/payment-methods',
  authController.restrictTo('rider'),
  paymentController.addPaymentMethod
);

// Set default payment method
router.patch(
  '/payment-methods/:paymentMethodId/default',
  authController.restrictTo('rider'),
  paymentController.setDefaultPaymentMethod
);

// Delete payment method
router.delete(
  '/payment-methods/:paymentMethodId',
  authController.restrictTo('rider'),
  paymentController.deletePaymentMethod
);

// ===========================================
// TRIP PAYMENT ROUTES
// ===========================================
// Process payment for completed trip (Riders only)
router.post(
  '/trip/pay',
  authController.restrictTo('rider'),
  paymentController.processTripPayment
);

// Process tip for driver (Riders only)
router.post(
  '/tip',
  authController.restrictTo('rider'),
  paymentController.processTip
);

// ===========================================
// PAYMENT HISTORY ROUTES
// ===========================================
// Get payment history (Riders and Drivers)
router.get(
  '/history',
  authController.restrictTo('rider', 'driver'),
  paymentController.getPaymentHistory
);

// Get specific payment details (Riders and Drivers)
router.get(
  '/payment/:paymentId',
  authController.restrictTo('rider', 'driver'),
  paymentController.getPaymentDetails
);

module.exports = router;
