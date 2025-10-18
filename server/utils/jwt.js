import jwt from 'jsonwebtoken';

// CRITICAL: JWT_SECRET must be set in environment variables
// Never use a fallback secret - fail fast if missing
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  console.error('❌ FATAL ERROR: JWT_SECRET environment variable is not set!');
  console.error('   Generate a secure secret with: openssl rand -hex 64');
  console.error('   Add it to your .env file: JWT_SECRET="your-generated-secret"');
  process.exit(1); // Crash the server - do not start without secure secret
}

// Generate JWT token from user payload
export function generateToken(payload) {
  if (!payload || !payload.userId) {
    throw new Error('User ID is required to generate token');
  }

  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Verify JWT token and return decoded payload
export function verifyToken(token) {
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch {
    // Token is invalid or expired
    return null;
  }
}
