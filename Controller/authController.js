const jwt = require('jsonwebtoken');
const locationHandler = require('./locationHandler');
const catchAsync = require('./../util/catchAsync');
const AppError = require('./../util/appError');

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
