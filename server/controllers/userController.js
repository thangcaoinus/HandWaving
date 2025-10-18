// User controller - profile management (display name, password, avatar upload/delete).
// Avatar processing: base64 → Sharp (resize 200x200, WebP quality 80, strip EXIF) → base64.

import bcrypt from 'bcrypt';
import { validationResult } from 'express-validator';
import sharp from 'sharp';
import prisma from '../config/prisma.js';
import {
  AuthenticationError,
  ValidationError,
  NotFoundError,
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

// Update display name only
export async function updateDisplayName(req, res, next) {
  try {
    checkValidationErrors(req);

    const userId = req.user.id;
    const { displayName } = req.body; // Already validated & sanitized by middleware

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { displayName },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info('Display name updated', {
      userId: userId,
      oldName: currentUser.displayName,
      newName: displayName
    });

    res.json({
      message: 'Display name updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

// Change password
export async function changePassword(req, res, next) {
  try {
    checkValidationErrors(req);

    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body; // Already validated by middleware

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!isPasswordValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    logger.info('Password changed', {
      userId: userId
    });

    res.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
}

// Upload avatar - process and store as base64 in database
export async function uploadAvatar(req, res, next) {
  try {
    const userId = req.user.id;
    const { avatarData } = req.body;

    // Extract base64 data from data URL using string split (prevents ReDoS)
    // Validation middleware already verified format, so this is safe
    const commaIndex = avatarData.indexOf(',');
    if (commaIndex === -1 || commaIndex < 10) {
      throw new ValidationError('Invalid image data format');
    }

    const base64Data = avatarData.substring(commaIndex + 1);
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Validate decoded buffer size (double-check after base64 decode)
    if (imageBuffer.length > 15 * 1024 * 1024) {
      throw new ValidationError('File too large (max 15MB)');
    }

    // Validate it's actually an image by getting metadata
    let metadata;
    try {
      metadata = await sharp(imageBuffer).metadata();
    } catch {
      throw new ValidationError('Invalid image file or corrupted data');
    }

    // Block SVG format (security risk: can contain embedded scripts)
    if (metadata.format === 'svg') {
      throw new ValidationError('SVG format not allowed for security reasons');
    }

    // Only allow safe raster formats
    const allowedFormats = ['jpeg', 'png', 'gif', 'webp'];
    if (!allowedFormats.includes(metadata.format)) {
      throw new ValidationError(`Format "${metadata.format}" not allowed. Use JPEG, PNG, GIF, or WebP`);
    }

    // Validate image dimensions (reject suspiciously large images)
    if (metadata.width > 10000 || metadata.height > 10000) {
      throw new ValidationError('Image dimensions too large (max 10000x10000)');
    }

    // Process image with security hardening:
    // - Strip all metadata (EXIF can contain malicious data)
    // - Resize to 200x200
    // - Convert to WebP quality 80
    // - Timeout after 10 seconds (prevent DoS)
    const processedBuffer = await Promise.race([
      sharp(imageBuffer)
        .resize(200, 200, { fit: 'cover' })
        .webp({ quality: 80 })
        .withMetadata(false) // Strip all metadata
        .toBuffer(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Image processing timeout')), 10000)
      ),
    ]);

    // Convert back to base64 data URL
    const processedBase64 = processedBuffer.toString('base64');
    const dataUrl = `data:image/webp;base64,${processedBase64}`;

    // Update user's avatarUrl in DB with data URL
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: dataUrl },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info('Avatar uploaded', {
      userId: userId,
      originalSize: imageBuffer.length,
      processedSize: processedBuffer.length,
      format: 'webp'
    });

    res.json({
      message: 'Avatar uploaded successfully',
      user: updatedUser,
    });
  } catch (error) {
    // Sanitize Sharp errors (don't leak internal info)
    if (error.message && error.message.includes('Input buffer')) {
      next(new ValidationError('Invalid or corrupted image file'));
    } else if (error.message && error.message.includes('timeout')) {
      next(new ValidationError('Image processing took too long'));
    } else {
      next(error);
    }
  }
}

// Delete avatar - remove from database
export async function deleteAvatar(req, res, next) {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (!user || !user.avatarUrl) {
      throw new ValidationError('No avatar to delete');
    }

    // Update DB to remove avatar
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info('Avatar deleted', {
      userId: userId
    });

    res.json({
      message: 'Avatar deleted successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}
