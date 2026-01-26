const client = require("prom-client");

client.collectDefaultMetrics();

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["method", "route", "status"],
  buckets: [50, 100, 200, 300, 500, 1000],
});

module.exports = {
  client,
  httpRequestDuration,
};
