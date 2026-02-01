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
const corsConfig = require("./config/cors");

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(globalRateLimiter);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(
  cors({
    origin: corsConfig,
    credentials: true,
  }),
);

app.use(
  fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    abortOnLimit: true,
  }),
);

app.use(requestIdMiddleware);
app.use(localeMiddleware);
app.use(metricsMiddleware);
app.use(loggerMiddleware);

app.use("/api/v1", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
