const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const locationHandler = require('./locationHandler');
const catchAsync = require('./../util/catchAsync');
const AppError = require('./../util/appError');
const Email = require('./../util/email');

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

    // ✅ FIXED: Don't set currentLocation during signup
    const filterBody = {
      name,
      email,
      password,
      passwordConfirm,
      phoneNo,
    };

    if (Model.modelName === 'Driver' && licenceNo) {
      filterBody.licenceNo = licenceNo;
    }

    const newUser = await Model.create(filterBody);

    try {
      const welcomeURL =
        process.env.NODE_ENV === 'production'
          ? process.env.FRONTEND_URL || 'https://youruberclone.com/dashboard'
          : 'http://localhost:8000/welcome-dummy-url';

      await new Email(newUser, welcomeURL).sendWelcome();
    } catch (emailError) {
      console.error('❌ Failed to send welcome email:', emailError);
    }

    createSendToken(newUser, 201, res, Model.modelName);
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
