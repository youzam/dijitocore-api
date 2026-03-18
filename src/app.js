const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const fileUpload = require("express-fileupload");

const routes = require("./routes");
const errorHandler = require("./middlewares/error.middleware");
const notFound = require("./middlewares/notFound.middleware");
const { globalRateLimiter } = require("./middlewares/rateLimit.middleware");
const localeMiddleware = require("./middlewares/locale.middleware");
const requestIdMiddleware = require("./middlewares/requestId.middleware");
const loggerMiddleware = require("./middlewares/logger.middleware");
const metricsMiddleware = require("./middlewares/metrics.middleware");
const adminAudit = require("./middlewares/adminAudit.middleware");
const adminActionRateLimit = require("./middlewares/adminActionRateLimit.middleware");
const suspiciousActivity = require("./middlewares/suspiciousActivity.middleware");
const bootstrapGuard = require("./middlewares/bootstrap.middleware");

const corsConfig = require("./config/cors");

const app = express();

/*
|--------------------------------------------------------------------------
| INFRASTRUCTURE CONFIGURATION
|--------------------------------------------------------------------------
| - trust proxy for correct IP detection (important for rate limiting, logs)
*/
app.set("trust proxy", true);

/*
|--------------------------------------------------------------------------
| GLOBAL SECURITY LAYER
|--------------------------------------------------------------------------
| - helmet: secure HTTP headers
| - globalRateLimiter: protect against abuse (applies to all routes)
*/
app.use(helmet());
app.use(globalRateLimiter);

/*
|--------------------------------------------------------------------------
| BODY PARSING
|--------------------------------------------------------------------------
| - JSON & URL encoded payloads
| - limit request size to prevent abuse
*/
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

/*
|--------------------------------------------------------------------------
| CORS CONFIGURATION
|--------------------------------------------------------------------------
| - controls which origins can access the API
| - allows credentials (cookies / auth headers)
*/
app.use(
  cors({
    origin: corsConfig,
    credentials: true,
  }),
);

/*
|--------------------------------------------------------------------------
| FILE UPLOAD HANDLING
|--------------------------------------------------------------------------
| - handles multipart/form-data
| - restricts file size (5MB)
*/
app.use(
  fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    abortOnLimit: true,
  }),
);

/*
|--------------------------------------------------------------------------
| SYSTEM LIFECYCLE GUARD
|--------------------------------------------------------------------------
| - blocks all requests before system bootstrap
| - prevents re-bootstrap after initialization
| - critical for system readiness enforcement
*/
app.use(bootstrapGuard);

/*
|--------------------------------------------------------------------------
| REQUEST CONTEXT ENRICHMENT
|--------------------------------------------------------------------------
| - requestIdMiddleware: attach unique request ID (tracing)
| - localeMiddleware: resolve language/locale
| - metricsMiddleware: collect performance metrics
| - loggerMiddleware: log request/response lifecycle
*/
app.use(requestIdMiddleware);
app.use(localeMiddleware);
app.use(metricsMiddleware);
app.use(loggerMiddleware);

/*
|--------------------------------------------------------------------------
| ADMIN SECURITY & CONTROL LAYER
|--------------------------------------------------------------------------
| - adminActionRateLimit: restrict admin abuse actions
| - suspiciousActivity: detect anomalies (security layer)
| - adminAudit: track admin actions for audit/compliance
*/
app.use(adminActionRateLimit);
app.use(suspiciousActivity);
app.use(adminAudit);

/*
|--------------------------------------------------------------------------
| WEBHOOK HANDLING
|--------------------------------------------------------------------------
| - preserves raw body for signature verification
| - applied only to webhook routes
*/
app.use(
  "/webhooks",
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);

/*
|--------------------------------------------------------------------------
| API ROUTES
|--------------------------------------------------------------------------
| - main application routes
| - all business logic flows through here
*/
app.use("/api/v1", routes);

/*
|--------------------------------------------------------------------------
| ERROR HANDLING LAYER
|--------------------------------------------------------------------------
| - notFound: handles unknown routes
| - errorHandler: centralized error processing
*/
app.use(notFound);
app.use(errorHandler);

module.exports = app;
