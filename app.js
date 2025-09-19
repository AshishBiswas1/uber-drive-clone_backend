const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const AppError = require('./util/appError');
const cors = require('cors');
const globalErrorHandler = require('./Controller/errorController');
const helmet = require('helmet');

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

// ✅ CRITICAL: CORS MUST BE BEFORE HELMET
const corsOptions = {
  origin: [
    'https://uber-drive-frontend.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    // Add any other domains you need
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Accept-Language',
    'Accept-Encoding',
    'Cache-Control',
    'Connection',
    'Host',
    'Referer',
    'User-Agent',
    'Authorization',
    'x-auth-token',
    'X-Auth-Token',
    'x-access-token',
    'X-Access-Token',
    'Authentication',
    'X-API-Key',
    'X-Client-ID',
    'X-Request-ID',
    'X-Correlation-ID',
    'X-Session-ID',
    'X-User-ID',
    'X-Device-ID',
    'x-user-role',
    'pragma',
    'X-App-Version',
    'X-Platform',
    'Content-Length',
    'Content-Encoding',
    'Content-Range',
    'Range',
    'If-Match',
    'If-None-Match',
    'If-Modified-Since',
    'If-Unmodified-Since',
    'X-CSRF-Token',
    'X-Requested-Token',
    'X-XSRF-TOKEN',
    'DNT',
    'Upgrade-Insecure-Requests',
    'X-Forwarded-For',
    'X-Forwarded-Proto',
    'X-Real-IP',
    'Upgrade',
    'Sec-WebSocket-Key',
    'Sec-WebSocket-Protocol',
    'Sec-WebSocket-Version',
    'Sec-Fetch-Site',
    'Sec-Fetch-Mode',
    'Sec-Fetch-Dest',
    'Sec-CH-UA',
    'Sec-CH-UA-Mobile',
    'Sec-CH-UA-Platform',
    'X-Apollo-Tracing',
    'X-GraphQL-Query',
    'X-Trace-ID',
    'X-Span-ID',
    'X-B3-TraceId',
    'X-B3-SpanId',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-File-Name',
    'X-File-Size',
    'X-File-Type',
    'X-Upload-Progress',
    'X-Latitude',
    'X-Longitude',
    'X-Location',
    'X-Rider-ID',
    'X-Driver-ID',
    'X-Trip-ID',
    'X-Vehicle-ID',
    'X-Location-Accuracy',
    'X-Timestamp',
    'X-Custom-Header',
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Per-Page',
    'X-Current-Page',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
    'X-Request-ID',
    'X-Response-Time',
    'ETag',
    'Last-Modified',
    'Location',
    'Content-Range',
    'Accept-Ranges',
  ],
  optionsSuccessStatus: 200,
  maxAge: 86400,
};

// ✅ Apply CORS FIRST
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ✅ Then apply helmet with CORS-friendly settings
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // Disable CSP that might block CORS
  })
);

app.use(cookieParser());

app.use(
  express.json({
    limit: '50kb',
  })
);

// ✅ Test endpoint with CORS headers
app.get('/', (req, res, next) => {
  // Manually set CORS headers as backup
  res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
  res.header('Access-Control-Allow-Credentials', 'true');

  res.status(200).json({
    status: 'Success',
    message: 'Backend is working - CORS enabled',
    timestamp: new Date().toISOString(),
    origin: req.get('Origin'),
    userAgent: req.get('User-Agent'),
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
