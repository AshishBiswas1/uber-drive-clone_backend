const express = require('express');
const helmet = require('helmet');
const AppError = require('./util/appError');
const globalErrorHandler = require('./Controller/errorController');

// All Routers
const tripRouter = require('./Router/tripRouter');
const driverRouter = require('./Router/driverRouter');
const riderRouter = require('./Router/riderRouter');

const app = express();

app.use(helmet());

app.use(
  express.json({
    limit: '50kb',
  })
);

app.use('/api/drive/trips', tripRouter);
app.use('/api/drive/driver', driverRouter);
app.use('/api/drive/rider', riderRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
