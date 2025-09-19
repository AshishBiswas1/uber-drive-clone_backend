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

const corsOptions = {
  // ✅ ORIGINS - All possible frontend URLs
  origin: [
    'http://localhost:3000', // Netlify deployment
  ],

  // ✅ CREDENTIALS - Important for JWT cookies
  credentials: true,

  // ✅ METHODS - All HTTP methods your app might use
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],

  // ✅ ALLOWED HEADERS - Comprehensive list for all possible frontend requests
  allowedHeaders: [
    // ✅ Standard headers
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

    // ✅ Authentication headers
    'Authorization', // JWT Bearer tokens
    'x-auth-token', // Custom auth token
    'X-Auth-Token', // Case variation
    'x-access-token', // Alternative auth header
    'X-Access-Token', // Case variation
    'Authentication', // Alternative spelling

    // ✅ Custom application headers
    'X-API-Key', // API keys
    'X-Client-ID', // Client identification
    'X-Request-ID', // Request tracking
    'X-Correlation-ID', // Request correlation
    'X-Session-ID', // Session tracking
    'X-User-ID', // User identification
    'X-Device-ID', // Device identification
    'x-user-role',
    'X-App-Version', // App version tracking
    'X-Platform', // Platform identification

    // ✅ Content and upload headers
    'Content-Length', // File uploads
    'Content-Encoding', // Compression
    'Content-Range', // Range requests
    'Range', // Partial content
    'If-Match', // Conditional requests
    'If-None-Match', // ETags
    'If-Modified-Since', // Caching
    'If-Unmodified-Since', // Conditional updates

    // ✅ CSRF and security headers
    'X-CSRF-Token', // CSRF protection
    'X-Requested-Token', // Custom CSRF
    'X-XSRF-TOKEN', // Angular CSRF

    // ✅ Browser and framework headers
    'DNT', // Do Not Track
    'Upgrade-Insecure-Requests',
    'X-Forwarded-For', // Proxy headers
    'X-Forwarded-Proto', // Protocol forwarding
    'X-Real-IP', // Real IP from proxy

    // ✅ WebSocket headers
    'Upgrade', // WebSocket upgrade
    'Sec-WebSocket-Key', // WebSocket handshake
    'Sec-WebSocket-Protocol', // WebSocket protocol
    'Sec-WebSocket-Version', // WebSocket version

    // ✅ Modern browser headers
    'Sec-Fetch-Site', // Fetch metadata
    'Sec-Fetch-Mode', // Request mode
    'Sec-Fetch-Dest', // Request destination
    'Sec-CH-UA', // Client hints
    'Sec-CH-UA-Mobile', // Mobile detection
    'Sec-CH-UA-Platform', // Platform detection

    // ✅ GraphQL headers
    'X-Apollo-Tracing', // Apollo GraphQL
    'X-GraphQL-Query', // GraphQL queries

    // ✅ Monitoring and analytics
    'X-Trace-ID', // Distributed tracing
    'X-Span-ID', // OpenTracing
    'X-B3-TraceId', // Zipkin tracing
    'X-B3-SpanId', // Zipkin spans

    // ✅ Rate limiting headers
    'X-RateLimit-Limit', // Rate limit info
    'X-RateLimit-Remaining', // Remaining requests
    'X-RateLimit-Reset', // Reset time

    // ✅ File upload headers
    'X-File-Name', // Original filename
    'X-File-Size', // File size
    'X-File-Type', // MIME type
    'X-Upload-Progress', // Upload progress

    // ✅ Geolocation headers
    'X-Latitude', // GPS latitude
    'X-Longitude', // GPS longitude
    'X-Location', // Combined location

    // ✅ Ride-booking specific headers
    'X-Rider-ID', // Rider identification
    'X-Driver-ID', // Driver identification
    'X-Trip-ID', // Trip identification
    'X-Vehicle-ID', // Vehicle identification
    'X-Location-Accuracy', // GPS accuracy
    'X-Timestamp', // Request timestamp

    // ✅ Fallback for any custom headers
    'X-Custom-Header', // Generic custom header
  ],

  // ✅ EXPOSED HEADERS - Headers the client can access
  exposedHeaders: [
    'X-Total-Count', // Pagination
    'X-Page-Count', // Page info
    'X-Per-Page', // Items per page
    'X-Current-Page', // Current page
    'X-Rate-Limit-Limit', // Rate limiting
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
    'X-Request-ID', // Request tracking
    'X-Response-Time', // Performance metrics
    'ETag', // Caching
    'Last-Modified', // Caching
    'Location', // Redirects
    'Content-Range', // Range requests
    'Accept-Ranges', // Range support
  ],

  // ✅ OPTIONS handling
  optionsSuccessStatus: 200, // For legacy browser support

  // ✅ Preflight cache duration (24 hours)
  maxAge: 86400,
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
