// controllers/paymentController.js
const Stripe = require('stripe');
const Payment = require('../Model/paymentModel');
const Trip = require('../Model/tripsModel');
const Driver = require('../Model/driverModel');
const Rider = require('../Model/riderModel');
const catchAsync = require('../util/catchAsync');
const AppError = require('../util/appError');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function buildSuccessUrl(host, paymentId) {
  // Build URL with your API structure: protocol://host/api/drive/payments/success?payment_id=xxx
  console.log(`${host}/api/drive/payment/success?payment_id=${paymentId}`);
  return `${host}/api/drive/payment/success?payment_id=${paymentId}`;
}

function buildCancelUrl(host, paymentId) {
  // Build URL with your API structure: protocol://host/api/drive/payments/cancel?payment_id=xxx
  console.log(`${host}/api/drive/payment/cancel?payment_id=${paymentId}`);
  return `${host}/api/drive/payment/cancel?payment_id=${paymentId}`;
}

function calculatePlatformFee(amount) {
  // Platform takes 20% commission
  return Math.round(amount * 0.2);
}

function calculateDriverEarnings(amount) {
  // Driver gets 80% after platform fee
  return Math.round(amount * 0.8);
}

// ===========================================
// PAYMENT SESSION ROUTES
// ===========================================

// Create Stripe Checkout Session for Trip Payment
exports.createCheckoutSession = catchAsync(async (req, res, next) => {
  const host = `${req.protocol}://${req.get('host')}`;
  const { tripId, tipAmount = 0, promoCode, paymentMethodId } = req.body;

  if (!tripId) {
    return next(new AppError('Trip ID is required', 400));
  }

  // Get trip details
  const trip = await Trip.findById(tripId).populate('driverId riderId');
  if (!trip) {
    return next(new AppError('Trip not found', 404));
  }

  // Verify rider owns this trip
  if (trip.riderId._id.toString() !== req.user.id) {
    return next(new AppError('You can only pay for your own trips', 403));
  }

  // Check if trip is completed
  if (trip.status !== 'completed') {
    return next(new AppError('Trip must be completed before payment', 400));
  }

  // Check if already paid
  const existingPayment = await Payment.findOne({
    tripId,
    status: { $in: ['paid', 'processing'] },
  });
  if (existingPayment) {
    return next(new AppError('Trip already paid for', 400));
  }

  let totalAmount = trip.fare.totalFare;
  let discount = 0;

  // Apply promo code if provided
  if (promoCode) {
    // Add promo code logic here
    // discount = await applyPromoCode(promoCode, totalAmount);
    // totalAmount -= discount;
  }

  // Add tip amount
  const finalAmount = totalAmount + tipAmount;

  // Create Payment document
  const paymentDoc = await Payment.create({
    riderId: req.user.id,
    driverId: trip.driverId._id,
    tripId: trip._id,
    amount: finalAmount,
    baseFare: trip.fare.totalFare,
    tipAmount,
    discount,
    platformFee: calculatePlatformFee(finalAmount),
    driverEarnings:
      calculateDriverEarnings(finalAmount - tipAmount) + tipAmount,
    currency: 'inr',
    status: 'created',
    paymentMethod: 'stripe',
    metadata: {
      tripDistance: trip.distance,
      tripDuration: trip.duration,
      pickupLocation: trip.pickupLocation.address,
      dropoffLocation: trip.dropoffLocation.address,
    },
  });

  const success_url = buildSuccessUrl(host, paymentDoc._id.toString());
  const cancel_url = buildCancelUrl(host, paymentDoc._id.toString());

  // Create Stripe session
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'inr',
          product_data: {
            name: `Uber Drive - Trip Payment`,
            description: `From ${trip.pickupLocation.address} to ${trip.dropoffLocation.address}`,
            images: ['https://yourdomain.com/uber-logo.png'],
          },
          unit_amount: Math.round(finalAmount * 100), // Convert to paise
        },
        quantity: 1,
      },
    ],
    customer_email: req.user.email,
    success_url,
    cancel_url,
    metadata: {
      paymentId: paymentDoc._id.toString(),
      tripId: trip._id.toString(),
      riderId: req.user.id,
      driverId: trip.driverId._id.toString(),
      type: 'trip_payment',
    },
  });

  // Update payment with Stripe session info
  paymentDoc.stripeSessionId = session.id;
  paymentDoc.sessionUrl = session.url;
  paymentDoc.status = 'pending';
  paymentDoc.expiresAt = new Date(session.expires_at * 1000);
  await paymentDoc.save();

  res.status(200).json({
    status: 'success',
    data: {
      paymentId: paymentDoc._id,
      sessionId: session.id,
      url: session.url,
      expiresAt: session.expires_at,
      amount: finalAmount,
      currency: 'inr',
    },
  });
});

// Create Payment Intent for immediate payment
exports.createPaymentIntent = catchAsync(async (req, res, next) => {
  const { tripId, tipAmount = 0, paymentMethodId } = req.body;

  if (!tripId) {
    return next(new AppError('Trip ID is required', 400));
  }

  const trip = await Trip.findById(tripId).populate('driverId riderId');
  if (!trip) {
    return next(new AppError('Trip not found', 404));
  }

  if (trip.riderId._id.toString() !== req.user.id) {
    return next(new AppError('You can only pay for your own trips', 403));
  }

  const totalAmount = trip.fare.totalFare + tipAmount;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(totalAmount * 100), // Convert to paise
    currency: 'inr',
    customer: req.user.stripeCustomerId,
    payment_method: paymentMethodId,
    confirmation_method: 'manual',
    confirm: true,
    return_url: `${req.protocol}://${req.get(
      'host'
    )}/api/drive/payments/return`,
    metadata: {
      tripId: trip._id.toString(),
      riderId: req.user.id,
      driverId: trip.driverId._id.toString(),
    },
  });

  // Create payment record
  const payment = await Payment.create({
    riderId: req.user.id,
    driverId: trip.driverId._id,
    tripId: trip._id,
    amount: totalAmount,
    baseFare: trip.fare.totalFare,
    tipAmount,
    platformFee: calculatePlatformFee(totalAmount),
    driverEarnings:
      calculateDriverEarnings(totalAmount - tipAmount) + tipAmount,
    currency: 'inr',
    status: 'processing',
    paymentMethod: 'stripe',
    stripePaymentIntentId: paymentIntent.id,
  });

  res.status(200).json({
    status: 'success',
    data: {
      paymentId: payment._id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    },
  });
});

// Confirm Payment Intent
exports.confirmPayment = catchAsync(async (req, res, next) => {
  const { paymentIntentId } = req.params;

  const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);

  const payment = await Payment.findOne({
    stripePaymentIntentId: paymentIntentId,
  });
  if (payment) {
    payment.status = paymentIntent.status === 'succeeded' ? 'paid' : 'failed';
    if (paymentIntent.status === 'succeeded') {
      payment.completedAt = new Date();
    }
    await payment.save();

    // Update trip status to paid
    if (paymentIntent.status === 'succeeded') {
      await Trip.findByIdAndUpdate(payment.tripId, { paymentStatus: 'paid' });
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
      },
    },
  });
});

// ===========================================
// SUCCESS & CANCEL HANDLERS
// ===========================================

// Payment Success Handler
exports.paymentSuccess = catchAsync(async (req, res, next) => {
  const { payment_id } = req.query;

  if (!payment_id) {
    return next(new AppError('Payment ID is required', 400));
  }

  // Get payment details
  const payment = await Payment.findById(payment_id)
    .populate('tripId', 'pickupLocation dropoffLocation fare distance duration')
    .populate('riderId', 'name email phoneNo')
    .populate('driverId', 'name email phoneNo');

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  // Update payment status to paid if not already updated by webhook
  if (payment.status !== 'paid') {
    payment.status = 'paid';
    payment.completedAt = new Date();
    await payment.save();

    // Update trip payment status
    await Trip.findByIdAndUpdate(payment.tripId, { paymentStatus: 'paid' });
  }

  // You can redirect to your frontend success page or return JSON
  // For API, return JSON response
  res.status(200).json({
    status: 'success',
    message: 'Payment completed successfully!',
    data: {
      payment: {
        id: payment._id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        completedAt: payment.completedAt,
        trip: {
          id: payment.tripId._id,
          from: payment.tripId.pickupLocation.address,
          to: payment.tripId.dropoffLocation.address,
          fare: payment.tripId.fare.totalFare,
          distance: payment.tripId.distance,
        },
        driver: {
          name: payment.driverId.name,
          phoneNo: payment.driverId.phoneNo,
        },
        breakdown: {
          baseFare: payment.baseFare,
          tipAmount: payment.tipAmount,
          discount: payment.discount,
          totalAmount: payment.amount,
        },
      },
    },
  });

  // Alternative: Redirect to frontend success page
  // res.redirect(`${process.env.FRONTEND_URL}/payment/success?payment_id=${payment_id}`);
});

// Payment Cancel Handler
exports.paymentCancel = catchAsync(async (req, res, next) => {
  const { payment_id } = req.query;

  if (!payment_id) {
    return next(new AppError('Payment ID is required', 400));
  }

  // Get payment details
  const payment = await Payment.findById(payment_id)
    .populate('tripId', 'pickupLocation dropoffLocation fare')
    .populate('riderId', 'name email');

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  // Update payment status to cancelled
  if (['created', 'pending'].includes(payment.status)) {
    payment.status = 'cancelled';
    await payment.save();
  }

  // Return JSON response
  res.status(200).json({
    status: 'cancelled',
    message: 'Payment was cancelled by the user',
    data: {
      payment: {
        id: payment._id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        trip: {
          id: payment.tripId._id,
          from: payment.tripId.pickupLocation.address,
          to: payment.tripId.dropoffLocation.address,
          fare: payment.tripId.fare.totalFare,
        },
      },
    },
  });

  // Alternative: Redirect to frontend cancel page
  // res.redirect(`${process.env.FRONTEND_URL}/payment/cancel?payment_id=${payment_id}`);
});

// Payment Return Handler (for payment intents)
exports.paymentReturn = catchAsync(async (req, res, next) => {
  const { payment_intent } = req.query;

  if (!payment_intent) {
    return next(new AppError('Payment intent ID is required', 400));
  }

  // Get payment by Stripe payment intent ID
  const payment = await Payment.findOne({
    stripePaymentIntentId: payment_intent,
  }).populate('tripId riderId driverId');

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  // Get latest payment intent status from Stripe
  const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent);

  // Update payment status based on Stripe status
  payment.status =
    paymentIntent.status === 'succeeded' ? 'paid' : paymentIntent.status;
  if (paymentIntent.status === 'succeeded') {
    payment.completedAt = new Date();
    // Update trip payment status
    await Trip.findByIdAndUpdate(payment.tripId, { paymentStatus: 'paid' });
  }
  await payment.save();

  res.status(200).json({
    status: 'success',
    data: {
      payment: {
        id: payment._id,
        status: payment.status,
        stripeStatus: paymentIntent.status,
        amount: payment.amount,
        currency: payment.currency,
      },
    },
  });
});

// ===========================================
// PAYMENT METHODS ROUTES
// ===========================================

// Get user's saved payment methods
exports.getPaymentMethods = catchAsync(async (req, res, next) => {
  if (!req.user.stripeCustomerId) {
    return res.status(200).json({
      status: 'success',
      data: { paymentMethods: [] },
    });
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: req.user.stripeCustomerId,
    type: 'card',
  });

  res.status(200).json({
    status: 'success',
    data: { paymentMethods: paymentMethods.data },
  });
});

// Add new payment method
exports.addPaymentMethod = catchAsync(async (req, res, next) => {
  const { paymentMethodId } = req.body;

  if (!paymentMethodId) {
    return next(new AppError('Payment method ID is required', 400));
  }

  // Create Stripe customer if doesn't exist
  let customerId = req.user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: req.user.email,
      name: req.user.name,
      phone: req.user.phoneNo,
      metadata: {
        userId: req.user.id,
        userType: req.user.role,
      },
    });
    customerId = customer.id;

    // Update user with Stripe customer ID
    const UserModel = req.user.role === 'driver' ? Driver : Rider;
    await UserModel.findByIdAndUpdate(req.user.id, {
      stripeCustomerId: customerId,
    });
  }

  // Attach payment method to customer
  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });

  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

  res.status(201).json({
    status: 'success',
    data: { paymentMethod },
  });
});

// Set default payment method
exports.setDefaultPaymentMethod = catchAsync(async (req, res, next) => {
  const { paymentMethodId } = req.params;

  if (!req.user.stripeCustomerId) {
    return next(new AppError('No payment methods found', 404));
  }

  await stripe.customers.update(req.user.stripeCustomerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  res.status(200).json({
    status: 'success',
    message: 'Default payment method updated successfully',
  });
});

// Delete payment method
exports.deletePaymentMethod = catchAsync(async (req, res, next) => {
  const { paymentMethodId } = req.params;

  await stripe.paymentMethods.detach(paymentMethodId);

  res.status(200).json({
    status: 'success',
    message: 'Payment method removed successfully',
  });
});

// ===========================================
// TRIP PAYMENT ROUTES
// ===========================================

// Process payment for completed trip
exports.processTripPayment = catchAsync(async (req, res, next) => {
  const { tripId, paymentMethodId, tipAmount = 0 } = req.body;

  const trip = await Trip.findById(tripId).populate('driverId');
  if (!trip) {
    return next(new AppError('Trip not found', 404));
  }

  if (trip.riderId.toString() !== req.user.id) {
    return next(new AppError('Unauthorized to pay for this trip', 403));
  }

  const totalAmount = trip.fare.totalFare + tipAmount;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(totalAmount * 100),
    currency: 'inr',
    customer: req.user.stripeCustomerId,
    payment_method: paymentMethodId,
    confirm: true,
    return_url: `${req.protocol}://${req.get(
      'host'
    )}/api/drive/payments/return`,
  });

  // Create payment record
  const payment = await Payment.create({
    riderId: req.user.id,
    driverId: trip.driverId._id,
    tripId: trip._id,
    amount: totalAmount,
    baseFare: trip.fare.totalFare,
    tipAmount,
    platformFee: calculatePlatformFee(totalAmount),
    driverEarnings:
      calculateDriverEarnings(totalAmount - tipAmount) + tipAmount,
    currency: 'inr',
    status: paymentIntent.status === 'succeeded' ? 'paid' : 'processing',
    paymentMethod: 'stripe',
    stripePaymentIntentId: paymentIntent.id,
    completedAt: paymentIntent.status === 'succeeded' ? new Date() : null,
  });

  // Update trip payment status
  if (paymentIntent.status === 'succeeded') {
    trip.paymentStatus = 'paid';
    await trip.save();
  }

  res.status(200).json({
    status: 'success',
    data: {
      payment,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        client_secret: paymentIntent.client_secret,
      },
    },
  });
});

// Process tip for driver
exports.processTip = catchAsync(async (req, res, next) => {
  const { tripId, tipAmount, paymentMethodId } = req.body;

  if (!tipAmount || tipAmount <= 0) {
    return next(new AppError('Tip amount must be greater than 0', 400));
  }

  const trip = await Trip.findById(tripId).populate('driverId');
  if (!trip) {
    return next(new AppError('Trip not found', 404));
  }

  if (trip.riderId.toString() !== req.user.id) {
    return next(new AppError('Unauthorized', 403));
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(tipAmount * 100),
    currency: 'inr',
    customer: req.user.stripeCustomerId,
    payment_method: paymentMethodId,
    confirm: true,
    description: `Tip for trip ${tripId}`,
  });

  // Create tip payment record
  const tipPayment = await Payment.create({
    riderId: req.user.id,
    driverId: trip.driverId._id,
    tripId: trip._id,
    amount: tipAmount,
    baseFare: 0,
    tipAmount,
    platformFee: 0, // No platform fee on tips
    driverEarnings: tipAmount, // Driver gets full tip
    currency: 'inr',
    status: paymentIntent.status === 'succeeded' ? 'paid' : 'processing',
    paymentMethod: 'stripe',
    stripePaymentIntentId: paymentIntent.id,
    type: 'tip',
    completedAt: paymentIntent.status === 'succeeded' ? new Date() : null,
  });

  res.status(200).json({
    status: 'success',
    data: { tipPayment, paymentStatus: paymentIntent.status },
  });
});

// ===========================================
// WEBHOOK HANDLER
// ===========================================

exports.webhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const paymentId = session.metadata?.paymentId;
        if (paymentId) {
          const payment = await Payment.findByIdAndUpdate(
            paymentId,
            {
              status: 'paid',
              stripePaymentIntentId: session.payment_intent || null,
              stripeCustomerId: session.customer || null,
              completedAt: new Date(),
            },
            { new: true }
          );

          // Update trip payment status
          if (payment) {
            await Trip.findByIdAndUpdate(payment.tripId, {
              paymentStatus: 'paid',
            });
          }
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: paymentIntent.id },
          {
            status: 'paid',
            completedAt: new Date(),
          }
        );
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: paymentIntent.id },
          {
            status: 'failed',
            failedAt: new Date(),
            failureReason: paymentIntent.last_payment_error?.message,
          }
        );
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        const paymentId = session.metadata?.paymentId;
        if (paymentId) {
          await Payment.findByIdAndUpdate(paymentId, {
            status: 'expired',
            expiredAt: new Date(),
          });
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handling error:', err);
    res.status(500).send('Webhook handler failed');
  }
};

// ===========================================
// PAYMENT HISTORY ROUTES
// ===========================================

// Get user's payment history
exports.getPaymentHistory = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query =
    req.user.role === 'driver'
      ? { driverId: req.user.id }
      : { riderId: req.user.id };

  const payments = await Payment.find(query)
    .populate('tripId', 'pickupLocation dropoffLocation distance duration')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalPayments = await Payment.countDocuments(query);

  res.status(200).json({
    status: 'success',
    results: payments.length,
    totalPages: Math.ceil(totalPayments / limit),
    currentPage: page,
    data: { payments },
  });
});

// Get specific payment details
exports.getPaymentDetails = catchAsync(async (req, res, next) => {
  const { paymentId } = req.params;

  const query =
    req.user.role === 'driver'
      ? { _id: paymentId, driverId: req.user.id }
      : { _id: paymentId, riderId: req.user.id };

  const payment = await Payment.findOne(query)
    .populate('tripId')
    .populate('riderId', 'name email phoneNo')
    .populate('driverId', 'name email phoneNo');

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { payment },
  });
});

// Add all your placeholder functions here...
