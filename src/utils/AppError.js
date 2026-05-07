class AppError extends Error {
  constructor(messageKey, statusCode = 500, code = null) {
    super(messageKey);

    this.messageKey = messageKey;
    this.statusCode = statusCode;
    this.code = code || this.generateCode(messageKey);

    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * 🔥 AUTO GENERATE ERROR CODE
   * "coupon.not_found" → "COUPON_NOT_FOUND"
   */
  generateCode(messageKey) {
    if (!messageKey) return 'INTERNAL_SERVER_ERROR';

    return messageKey.replace(/\./g, '_').replace(/\s+/g, '_').toUpperCase();
  }
}

module.exports = AppError;
