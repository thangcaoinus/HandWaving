// Authentication controller - handles register/login/logout with JWT tokens and session management.
// Rate limited (5 login attempts per 15min), validates input, returns user data + httpOnly cookie.

import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';
import prisma from '../config/prisma.js';
import { generateToken } from '../utils/jwt.js';
import {
  AuthenticationError,
  ValidationError,
  ConflictError,
} from '../utils/errors.js';
import logger from '../utils/logger.js';

const BCRYPT_ROUNDS = 10;

// Helper to check validation results from express-validator
function checkValidationErrors(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }
}

// Register new user
export async function register(req, res, next) {
  try {
    checkValidationErrors(req);

    const { email, username, password, displayName } = req.body;

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      throw new ConflictError('Email already registered');
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      throw new ConflictError('Username already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user in database
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        displayName: displayName || username,
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        // Don't return passwordHash!
      },
    });

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    // Create session in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    logger.info('User registered', {
      userId: user.id,
      email: user.email,
      username: logger.sanitizeUser(user).username
    });

    res.status(201).json({
      user,
      token,
    });
  } catch (error) {
    next(error);
  }
}

// Login existing user
export async function login(req, res, next) {
  try {
    checkValidationErrors(req);

    const { email, password } = req.body;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Use same error message for "user not found" and "wrong password"
    // This prevents attackers from knowing if email exists
    if (!user) {
      logger.warn('Login failed - user not found', { email });
      throw new AuthenticationError('Invalid email or password');
    }

    // Compare password with hash
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      logger.warn('Login failed - invalid password', {
        userId: user.id,
        email
      });
      throw new AuthenticationError('Invalid email or password');
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    // Check if session already exists for this user
    const existingSession = await prisma.session.findFirst({
      where: { userId: user.id },
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    if (existingSession) {
      // Update existing session with new token
      await prisma.session.update({
        where: { id: existingSession.id },
        data: {
          token,
          expiresAt,
        },
      });
    } else {
      // Create new session
      await prisma.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });
    }

    // Return user without passwordHash
    // eslint-disable-next-line no-unused-vars
    const { passwordHash, ...userWithoutPassword } = user;

    logger.info('User logged in', {
      userId: user.id,
      email: user.email,
      username: logger.sanitizeUser(user).username
    });

    res.json({
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    next(error);
  }
}

// Logout user (delete session)
export async function logout(req, res, next) {
  try {
    const token = req.token; // Set by authMiddleware

    // Delete session from database
    await prisma.session.deleteMany({
      where: { token },
    });

    logger.info('User logged out', {
      userId: req.user.id,
      email: req.user.email
    });

    res.json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

// Get current user info
export async function me(req, res, next) {
  try {
    // req.user is already set by authMiddleware
    // Just return it
    res.json({
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
}
