import { Router } from 'express';
import { validateRegister, validateLogin } from '../utils/validation.js';
import { authMiddleware } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import * as authController from '../controllers/authController.js';

const router = Router();

// Public routes (no authentication required)

// POST /api/auth/register - Create new user account
router.post('/register', authLimiter, validateRegister, authController.register);

// POST /api/auth/login - Authenticate user
router.post('/login', authLimiter, validateLogin, authController.login);

// Protected routes (authentication required)

// POST /api/auth/logout - Invalidate session
router.post('/logout', authMiddleware, authController.logout);

// GET /api/auth/me - Get current user info
router.get('/me', authMiddleware, authController.me);

export default router;
