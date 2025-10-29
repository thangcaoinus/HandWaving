// Rate limiting middleware - protects sensitive endpoints from abuse.
// Limits: 5 login/15min, 10 avatar upload/hour, 3 password change/hour, 20 canvas create/hour.

import rateLimit from 'express-rate-limit';

// Strict rate limiter for authentication endpoints
// Prevents brute force attacks on login/register
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 5,
  keyGenerator: (req) => {
    const email = req.body?.email || 'anonymous';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `${email}:${ip}`;
  },
  message: {
    error: 'Too many authentication attempts. Please try again in 15 minutes.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the maximum number of authentication attempts. Please try again in 15 minutes.',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000),
    });
  },
});

// Heavy upload rate limiter
// Prevents DoS via large file uploads
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip || 'anonymous',
  message: {
    error: 'Too many upload attempts. Please try again later.',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Upload limit exceeded. You can upload up to 10 files per hour.',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000),
    });
  },
});

// General API rate limiter
// Prevents abuse of API endpoints
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'Too many requests. Please slow down.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You are making too many requests. Please try again in a few minutes.',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000),
    });
  },
});

// Password change limiter (stricter than general API)
// Prevents brute force attempts on password change
export const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.user?.id || req.ip || 'anonymous',
  message: {
    error: 'Too many password change attempts.',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You can only change your password 3 times per hour. Please try again later.',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000),
    });
  },
});

// Canvas creation limiter
// Prevents spam canvas creation
export const canvasCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id || req.ip || 'anonymous',
  message: {
    error: 'Too many canvases created.',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Canvas creation limit reached (20 per hour). Please try again later.',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000),
    });
  },
});
