const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const locationHandler = require('./locationHandler');
const catchAsync = require('./../util/catchAsync');
const AppError = require('./../util/appError');
const Email = require('./../util/email');
const { promisify } = require('util');
const Driver = require('./../Model/driverModel');
const Rider = require('./../Model/riderModel');
const { initiatePhoneVerification } = require('../util/smsVerification');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res, userType) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    userType,
    data: {
      user,
    },
  });
};

// TODO: Add the GPS in frontend and then the users current location

exports.signup = (Model) =>
  catchAsync(async (req, res, next) => {
    const { name, email, password, passwordConfirm, phoneNo, licenceNo } =
      req.body;

    if (!name || !email || !password || !passwordConfirm || !phoneNo) {
      return next(new AppError('Please provide all required fields', 400));
    }

    if (Model.modelName === 'Driver' && !licenceNo) {
      return next(new AppError('Driver must provide licence number', 400));
    }

    // Format phone number properly
    const formattedPhoneNo = phoneNo.startsWith('+')
      ? phoneNo
      : `+91${phoneNo}`;

    // Check if phone number or email is already registered
    const existingUser = await Model.findOne({
      $or: [
        { phoneNo: formattedPhoneNo },
        { phoneNo: phoneNo },
        { email: email.toLowerCase() },
      ],
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return next(
          new AppError(`${Model.modelName} with this email already exists`, 400)
        );
      }
      if (
        existingUser.phoneNo === formattedPhoneNo ||
        existingUser.phoneNo === phoneNo
      ) {
        return next(
          new AppError(
            `${Model.modelName} with this phone number already exists`,
            400
          )
        );
      }
    }

    // Create user data with phone verification fields set to false initially
    const filterBody = {
      name,
      email: email.toLowerCase(),
      password,
      passwordConfirm,
      phoneNo: formattedPhoneNo,
      // Set phone verification fields to false by default
      phoneVerified: false,
      phoneVerifiedAt: null,
      firebaseUid: null,
    };

    if (Model.modelName === 'Driver' && licenceNo) {
      filterBody.licenceNo = licenceNo;
    }

    const newUser = await Model.create(filterBody);

    // 🔥 NEW: Auto-initiate phone verification and prepare for SMS
    let verificationSession = null;
    let smsStatus = 'failed';

    try {
      // Initiate phone verification session
      verificationSession = await initiatePhoneVerification(formattedPhoneNo);
      smsStatus = 'initiated';

      console.log(
        `📱 Phone verification initiated for new user: ${newUser.name} (${formattedPhoneNo})`
      );
      console.log(`🔑 Session ID: ${verificationSession.sessionId}`);
    } catch (error) {
      console.error(
        '❌ Failed to initiate phone verification during signup:',
        error
      );
      // Don't fail signup if verification fails, just log it
    }

    // Send welcome email
    try {
      const welcomeURL =
        process.env.NODE_ENV === 'production'
          ? process.env.FRONTEND_URL || 'https://youruberclone.com/dashboard'
          : 'http://localhost:8000/welcome-dummy-url';

      await new Email(newUser, welcomeURL).sendWelcome();
    } catch (emailError) {
      console.error('❌ Failed to send welcome email:', emailError);
    }

    // Prepare response with verification session details
    const additionalData = {
      phoneVerification: {
        isVerified: false,
        sessionId: verificationSession?.sessionId || null,
        smsStatus: smsStatus,
        phone: formattedPhoneNo,
        expiresIn: verificationSession?.expiresIn || null,
        message:
          smsStatus === 'initiated'
            ? 'Account created successfully! SMS verification has been initiated. Use Firebase SDK to send OTP to complete verification.'
            : 'Account created successfully! Please verify your mobile number to access all features.',
        action:
          smsStatus === 'initiated'
            ? 'Use Firebase SDK with the provided sessionId to send OTP'
            : 'Navigate to Profile/Settings → Verify Phone Number',
        endpoints: {
          verify: '/api/auth/verify-phone',
        },
      },
      message: `${Model.modelName} account created successfully! ${
        smsStatus === 'initiated'
          ? 'SMS verification initiated - use the sessionId to send OTP.'
          : 'Please verify your mobile number later.'
      }`,
      nextSteps:
        smsStatus === 'initiated'
          ? [
              `Welcome to Uber Drive! Your ${Model.modelName.toLowerCase()} account has been created.`,
              'SMS verification has been initiated:',
              '1. Use Firebase SDK with the provided sessionId to send OTP',
              '2. User will receive OTP on their phone',
              '3. Complete verification using /api/auth/verify-phone endpoint',
              'Note: Session expires in 10 minutes.',
            ]
          : [
              `Welcome to Uber Drive! Your ${Model.modelName.toLowerCase()} account has been created.`,
              'To complete your setup and access all features:',
              '1. Go to your profile/settings page',
              "2. Click 'Verify Phone Number'",
              '3. Follow the verification process',
              `Note: Phone verification is required for ${
                Model.modelName === 'Driver'
                  ? 'receiving ride requests and payments'
                  : 'booking rides and making payments'
              }.`,
            ],
    };

    createSendToken(newUser, 201, res, Model.modelName, additionalData);
  });

exports.login = (Model) =>
  catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    console.log('Inside Login Function');

    // 1) Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // 2) Check if user exists && password is correct
    const user = await Model.findOne({ email }).select('+password');

    if (!user || !(await user.correctPassword(password, user.password))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    // 3) Driver-specific validation
    if (Model.modelName === 'Driver') {
      // Check if the driver is active
      if (user.isActive === false) {
        return next(
          new AppError(
            'Your account has been deactivated. Please contact support.',
            401
          )
        );
      }
    }

    // 4) If everything ok, send token to client
    createSendToken(user, 200, res, Model.modelName);
  });

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists in either Driver or Rider models
  let currentUser;

  // Try Driver model first
  currentUser = await Driver.findById(decoded.id);
  if (currentUser) {
    currentUser.role = currentUser.role || 'driver';
  } else {
    // Try Rider model
    currentUser = await Rider.findById(decoded.id);

    if (currentUser) {
      currentUser.role = currentUser.role || 'rider';
    }
  }

  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );
  }

  // 4) Check if user changed password after the token was issued
  if (
    currentUser.changedPasswordAfter &&
    currentUser.changedPasswordAfter(decoded.iat)
  ) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401)
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

exports.forgetPassword = (Model) =>
  catchAsync(async (req, res, next) => {
    // 1) Get user based on posted email
    const email = req.body.email;

    const user = await Model.findOne({ email });

    // 2) Check if the user with the email exists or not
    if (!user) {
      return next(
        new AppError('There is no user with that email address.', 404)
      );
    }

    // 3) Generate the random reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // 4) Send it to user's email
    try {
      const resetURL =
        process.env.NODE_ENV === 'production'
          ? `${
              process.env.FRONTEND_URL
            }/api/drive/${Model.modelName.toLowerCase()}/resetPassword/${resetToken}`
          : `http://localhost:8000/api/drive/${Model.modelName.toLowerCase()}/resetPassword/${resetToken}`;

      await new Email(user, resetURL).sendPasswordReset();
    } catch (err) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return next(
        new AppError(
          'There was an error sending the email. Try again later!',
          500
        )
      );
    }

    res.status(200).json({
      status: 'success',
      message: 'Password reset token sent to email!',
    });
  });

exports.resetPassword = (Model) =>
  catchAsync(async (req, res, next) => {
    // 1) Get user based on the resetToken
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await Model.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    // 2) If the token has not expired and there is a user, set the new password
    if (!user) {
      return next(new AppError('Token is invalid or has expired', 400));
    }

    // 3) Update passwords and clear reset token fields
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // 4) Save user (trigger pre-save middleware to hash password)
    await user.save();

    // 5) Send Success email Notification
    try {
      const loginUrl =
        process.env.NODE_ENV === 'production'
          ? `${process.env.FRONTEND_URL}/login`
          : 'http://localhost:8000/login';

      await new Email(user, loginUrl).sendPasswordResetSuccess();
    } catch (emailError) {
      console.error('Failed to send success email:', emailError);
    }

    // Log the user in, send jwt
    createSendToken(user, 200, res, Model.modelName);
  });
