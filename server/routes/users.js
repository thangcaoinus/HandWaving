import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { uploadLimiter, passwordChangeLimiter } from '../middleware/rateLimiter.js';
import { updateDisplayName, changePassword, uploadAvatar, deleteAvatar } from '../controllers/userController.js';
import { validateDisplayName, validatePasswordChange, validateAvatarUpload } from '../middleware/validation.js';

const router = express.Router();

// Update display name
router.put('/profile/name', authMiddleware, validateDisplayName, updateDisplayName);

// Change password
router.put('/password', authMiddleware, passwordChangeLimiter, validatePasswordChange, changePassword);

// Upload avatar (base64 data)
router.post('/profile/avatar', authMiddleware, uploadLimiter, validateAvatarUpload, uploadAvatar);

// Delete avatar
router.delete('/profile/avatar', authMiddleware, deleteAvatar);

export default router;
