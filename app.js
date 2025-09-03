const express = require('express');
const helmet = require('helmet');
const AppError = require('./util/appError');

// All Routers
const tripRouter = require('./Router/tripRouter');

const app = express();

app.use(helmet());

app.use(
 express.json({
  limit: '50kb',
 })
);

app.use('/api/drive/trips', tripRouter);

app.all('*', (req, res, next) => {
 next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

module.exports = app;
