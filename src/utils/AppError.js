class AppError extends Error {
  constructor(messageKey, statusCode) {
    super(messageKey);
    this.messageKey = messageKey;
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

module.exports = AppError;
