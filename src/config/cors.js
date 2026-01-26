const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://app.dijitotrack.com",
  "https://admin.dijitotrack.com",
];

// Allow wildcard subdomains: *.dijitotrack.com
const isAllowedSubdomain = (origin) => {
  try {
    const url = new URL(origin);
    return url.hostname.endsWith(".dijitotrack.com");
  } catch {
    return false;
  }
};

module.exports = (origin, callback) => {
  // Allow non-browser requests (Postman, curl)
  if (!origin) {
    return callback(null, true);
  }

  if (allowedOrigins.includes(origin) || isAllowedSubdomain(origin)) {
    return callback(null, true);
  }

  return callback(new Error("Not allowed by CORS"));
};
