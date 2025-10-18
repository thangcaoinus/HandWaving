import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../utils/errors.js';

// Centralized error handler middleware
export function errorHandler(err, req, res, _next) {
  // Log error for debugging
  console.error('Error:', err.name, err.message);
  
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack:', err.stack);
  }

  // Default to 500 Internal Server Error
  let statusCode = 500;
  let message = 'Internal server error';
  let details = null;

  // Map custom error classes to HTTP status codes
  if (err instanceof AuthenticationError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof AuthorizationError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ValidationError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof NotFoundError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ConflictError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.statusCode) {
    // Handle any error with statusCode property
    statusCode = err.statusCode;
    message = err.message;
  }

  // Send error response
  const response = {
    error: message,
  };

  // Include details in development or if explicitly provided
  if (details || (process.env.NODE_ENV === 'development' && err.stack)) {
    response.details = details || err.stack;
  }

  res.status(statusCode).json(response);
}
