// JWT authentication middleware - validates tokens from Authorization header or cookies.
// Attaches user object to req.user. Returns 401 if missing/invalid token.

import { verifyToken } from '../utils/jwt.js';
import { AuthenticationError } from '../utils/errors.js';
import prisma from '../config/prisma.js';

// Optional auth middleware - doesn't fail if no token, just skips auth
export async function optionalAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // No token? That's okay, just continue without user
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      req.user = null;
      return next();
    }

    // Check session
    const session = await prisma.session.findUnique({
      where: { token },
    });

    if (!session || session.expiresAt < new Date()) {
      req.user = null;
      return next();
    }

    // Look up user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isGuest: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    req.user = user || null;
    req.token = token;
    req.session = session;

    next();
  } catch {
    // On error, just treat as unauthenticated
    req.user = null;
    next();
  }
}

// Middleware to verify JWT token and attach user to request (REQUIRED auth)
export async function authMiddleware(req, res, next) {
  try {
    // Extract token from Authorization header (format: "Bearer <token>")
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token signature and expiration
    const decoded = verifyToken(token);
    
    if (!decoded) {
      throw new AuthenticationError('Invalid or expired token');
    }

    // Check if session exists in database (prevents using tokens after logout)
    const session = await prisma.session.findUnique({
      where: { token },
    });

    if (!session) {
      throw new AuthenticationError('Session not found - please login again');
    }

    // Check if session has expired
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await prisma.session.delete({ where: { id: session.id } });
      throw new AuthenticationError('Session expired - please login again');
    }

    // Look up user in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isGuest: true,
        createdAt: true,
        updatedAt: true,
        // Never expose passwordHash
      },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Attach user and token to request for use in route handlers
    req.user = user;
    req.token = token;
    req.session = session;
    
    next();
  } catch (error) {
    next(error);
  }
}
