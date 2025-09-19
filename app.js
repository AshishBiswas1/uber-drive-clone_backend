const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const AppError = require('./util/appError');
const cors = require('cors');
const globalErrorHandler = require('./Controller/errorController');

// All Routers
const tripRouter = require('./Router/tripRouter');
const driverRouter = require('./Router/driverRouter');
const riderRouter = require('./Router/riderRouter');
const reviewRouter = require('./Router/reviewRouter');
const paymentRouter = require('./Router/paymentRouter');

const app = express();

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

const ALLOWED_ORIGIN = 'https://uber-drive-frontend-a5ys.vercel.app';

app.use((req, res, next) => {
  res.header('Vary', 'Origin');
  next();
});

const corsOptions = {
  origin: ALLOWED_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

app.options('*', cors(corsOptions));

app.use(cookieParser());

app.use(helmet());

app.use(
  express.json({
    limit: '50kb',
  })
);

app.get('/', (req, res, next) => {
  res.status(200).json({
    status: 'Success',
    message: 'Not allowed to use this',
  });
});

app.use('/api/drive/trips', tripRouter);
app.use('/api/drive/driver', driverRouter);
app.use('/api/drive/rider', riderRouter);
app.use('/api/drive/review', reviewRouter);
app.use('/api/drive/payment', paymentRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
