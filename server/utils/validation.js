import { body } from 'express-validator';

// Registration validation rules
export const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be 3-20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),
  
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Display name must be 1-50 characters')
    .escape(),  // Escape HTML entities to prevent XSS
];

// Login validation rules
export const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// Canvas validation rules
export const validateCanvas = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be 1-100 characters')
    .escape(),  // Escape HTML to prevent XSS
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be max 500 characters')
    .escape(),  // Escape HTML to prevent XSS
  
  body('data')
    .optional()
    .custom((value) => {
      if (value !== undefined && (typeof value !== 'object' || value === null)) {
        throw new Error('Canvas data must be a valid object');
      }
      
      // Validate strokes structure only if data is provided
      if (value && value.strokes) {
        if (!Array.isArray(value.strokes)) {
          throw new Error('Strokes must be an array');
        }

        // Basic validation of each stroke
        for (const stroke of value.strokes) {
          if (typeof stroke !== 'object' || !stroke.id) {
            throw new Error('Invalid stroke structure');
          }

          // Validate color format if present
          if (stroke.config?.color && !/^#[0-9A-Fa-f]{6}$/.test(stroke.config.color)) {
            throw new Error('Invalid color format');
          }

          // Validate width if present
          if (stroke.config?.width !== undefined && (typeof stroke.config.width !== 'number' || stroke.config.width < 1 || stroke.config.width > 50)) {
            throw new Error('Invalid stroke width (must be 1-50)');
          }
        }
      }

      return true;
    }),
  
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),

  body('linkSharingEnabled')
    .optional()
    .isBoolean()
    .withMessage('linkSharingEnabled must be a boolean'),

  body('shareRole')
    .optional()
    .isIn(['VIEWER', 'EDITOR'])
    .withMessage('shareRole must be VIEWER or EDITOR'),
];

// Collaboration validation rules
export const validateAddCollaborator = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('role')
    .optional()
    .isIn(['VIEWER', 'EDITOR', 'ADMIN'])
    .withMessage('Role must be VIEWER, EDITOR, or ADMIN'),
];

export const validateUpdateRole = [
  body('role')
    .isIn(['VIEWER', 'EDITOR', 'ADMIN'])
    .withMessage('Role must be VIEWER, EDITOR, or ADMIN'),
];
