import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format for console output (human-readable)
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}] ${message}`;

  // Add metadata if present (but sanitize sensitive fields)
  if (Object.keys(metadata).length > 0) {
    const sanitized = sanitizeMetadata(metadata);
    if (Object.keys(sanitized).length > 0) {
      msg += ` ${JSON.stringify(sanitized)}`;
    }
  }

  return msg;
});

// Sanitize sensitive data from logs
function sanitizeMetadata(metadata) {
  const sanitized = { ...metadata };

  // Remove/redact sensitive fields
  const sensitiveFields = [
    'password',
    'passwordHash',
    'token',
    'jwt',
    'secret',
    'authorization',
    'cookie',
  ];

  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });

  // Truncate usernames (show first 3 chars + ***)
  if (sanitized.username && sanitized.username.length > 3) {
    sanitized.username = sanitized.username.substring(0, 3) + '***';
  }

  // Hash anonymous IDs (show first 8 chars only)
  if (sanitized.anonymousId && sanitized.anonymousId.length > 8) {
    sanitized.anonymousId = sanitized.anonymousId.substring(0, 8) + '...';
  }

  return sanitized;
}

// Determine log level based on environment
const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Create the logger
const logger = winston.createLogger({
  level: logLevel,
  format: combine(
    errors({ stack: true }), // Log error stack traces
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
  ),
  transports: [
    // Console output (always enabled)
    new winston.transports.Console({
      format: combine(
        colorize(),
        consoleFormat
      ),
    }),

    // Error log file (production only)
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: combine(
          timestamp(),
          winston.format.json() // JSON format for easier parsing
        ),
      }),

      // Combined log file (all levels)
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: combine(
          timestamp(),
          winston.format.json()
        ),
      }),
    ] : []),
  ],

  // Don't exit on uncaught exceptions
  exitOnError: false,
});

// Helper function to sanitize user object before logging
logger.sanitizeUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username?.substring(0, 3) + '***',
    isAnonymous: user.isAnonymous || false,
  };
};

// Helper to create redacted socket ID (first 8 chars)
logger.sanitizeSocketId = (socketId) => {
  if (!socketId) return null;
  return socketId.substring(0, 8) + '...';
};

// Helper to sanitize room/canvas ID (first 8 chars)
logger.sanitizeId = (id) => {
  if (!id) return null;
  return id.substring(0, 8) + '...';
};

export default logger;
