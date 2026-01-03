const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Rate Limiting Configuration
 * 
 * Strategy (same limits for dev & production):
 * 1. Global limiter - Safety net for all routes
 * 2. Auth limiter - Strict limits for login/register (prevent brute force)
 * 3. Write limiter - Moderate limits for POST/PUT/DELETE
 * 4. Read limiter - Relaxed limits for GET requests
 * 5. Admin limiter - Moderate limits for admin panel
 * 6. Payment limiter - Strict limits for payment routes
 */

// Helper to create consistent error responses
const createRateLimitHandler = (message) => (req, res) => {
  logger.warn(`Rate limit exceeded: ${req.ip} - ${req.method} ${req.originalUrl}`);
  res.status(429).json({
    success: false,
    message: message
  });
};

// 1. Global rate limiter - very generous, catches abuse
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // High limit - safety net
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/test', // Skip health checks
  handler: createRateLimitHandler('Too many requests, please try again later')
});

// 2. Strict limiter for authentication routes (login, register, password reset)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Very strict - 15 attempts per 15 min
  message: { success: false, message: 'Too many authentication attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
  handler: createRateLimitHandler('Too many authentication attempts, please try again after 15 minutes')
});

// 3. Moderate limiter for write operations (POST, PUT, DELETE)
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 write operations per 15 min
  message: { success: false, message: 'Too many write requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many write requests, please slow down')
});

// 4. Relaxed limiter for read operations (GET)
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 read operations per 15 min
  message: { success: false, message: 'Too many read requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many read requests, please slow down')
});

// 5. Admin limiter - moderate limits
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 admin operations per 15 min
  message: { success: false, message: 'Too many admin requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many admin requests, please try again later')
});

// 6. Payment routes - strict limits
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 payment operations per hour
  message: { success: false, message: 'Too many payment requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many payment requests, please try again later')
});

// 7. Order limiter - moderate limits for order operations
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 order operations per 15 min
  message: { success: false, message: 'Too many order requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many order requests, please slow down')
});

// Middleware to apply read/write limiters based on HTTP method
const methodBasedLimiter = (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return writeLimiter(req, res, next);
  }
  return readLimiter(req, res, next);
};

module.exports = {
  globalLimiter,
  authLimiter,
  writeLimiter,
  readLimiter,
  adminLimiter,
  paymentLimiter,
  orderLimiter,
  methodBasedLimiter
};
