import { body } from 'express-validator';

// Validation rules for updating display name
export const validateDisplayName = [
  body('displayName')
    .trim()
    .notEmpty()
    .withMessage('Display name cannot be empty')
    .isLength({ min: 1, max: 50 })
    .withMessage('Display name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9\s\-_.]+$/)
    .withMessage('Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods'),
];

// Validation rules for changing password
export const validatePasswordChange = [
  body('currentPassword')
    .trim()
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .trim()
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),

  body('newPassword')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),
];

// Validation rules for avatar upload
export const validateAvatarUpload = [
  body('avatarData')
    .notEmpty()
    .withMessage('Avatar data is required')
    .isString()
    .withMessage('Avatar data must be a string')
    .custom((value) => {
      // FIRST: Validate total length (prevent DoS before any processing)
      if (value.length > 22000000) {
        // 22MB total (15MB binary → ~20MB base64 + header)
        throw new Error('Data too large (max 15MB image)');
      }
      return true;
    })
    .custom((value) => {
      // SECOND: Fast prefix checks (fail fast before regex)
      if (!value.startsWith('data:image/')) {
        throw new Error('Invalid image data URL');
      }
      const colonIndex = value.indexOf(';base64,');
      if (colonIndex === -1 || colonIndex > 30) {
        // ;base64, should appear within first 30 chars (data:image/jpeg;base64,)
        throw new Error('Invalid image data URL format');
      }
      return true;
    })
    .custom((value) => {
      // THIRD: Split string first, then regex only on small header
      // This ensures O(n) complexity - no regex on 7MB payload

      const commaIndex = value.indexOf(',');
      if (commaIndex === -1 || commaIndex < 10) {
        // Comma must exist and header must be reasonable length
        throw new Error('Invalid image data URL format');
      }

      const header = value.substring(0, commaIndex); // e.g., "data:image/jpeg;base64"
      const base64Part = value.substring(commaIndex + 1);

      // Validate header with regex (only runs on ~25-30 chars, not 7MB!)
      // This is O(header.length) which is effectively O(1) since header is always small
      if (!/^data:image\/(jpeg|jpg|png|gif|webp);base64$/.test(header)) {
        throw new Error('Invalid image format. Only JPEG, PNG, GIF, WebP allowed');
      }

      // Validate base64 part length
      if (base64Part.length === 0) {
        throw new Error('No image data provided');
      }
      if (base64Part.length > 21000000) {
        throw new Error('File too large (max 15MB)');
      }

      // Validate base64 characters using charCodeAt (faster than charAt)
      // This is O(n) linear scan - no backtracking possible
      for (let i = 0; i < base64Part.length; i++) {
        const code = base64Part.charCodeAt(i);

        // Base64 valid chars: A-Z (65-90), a-z (97-122), 0-9 (48-57), + (43), / (47), = (61)
        const isValid =
          (code >= 65 && code <= 90) ||   // A-Z
          (code >= 97 && code <= 122) ||  // a-z
          (code >= 48 && code <= 57) ||   // 0-9
          code === 43 ||                   // +
          code === 47 ||                   // /
          code === 61;                     // =

        if (!isValid) {
          throw new Error('Invalid base64 encoding');
        }

        // Padding = can only appear at the very end (last 2 positions max)
        if (code === 61 && i < base64Part.length - 2) {
          throw new Error('Invalid base64 padding');
        }
      }

      return true;
    })
    .custom((value) => {
      // FOURTH: Validate base64 decodes correctly
      const base64Part = value.split(',')[1];
      try {
        const buffer = Buffer.from(base64Part, 'base64');
        // Validate decoded size
        if (buffer.length > 15 * 1024 * 1024) {
          throw new Error('Decoded image too large (max 15MB)');
        }
      } catch {
        throw new Error('Invalid base64 encoding');
      }
      return true;
    }),
];
