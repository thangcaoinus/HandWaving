import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { canvasCreationLimiter } from '../middleware/rateLimiter.js';
import { validateCanvas } from '../utils/validation.js';
import * as canvasController from '../controllers/canvasController.js';

const router = Router();

// GET /api/canvases - List user's canvases
router.get('/', authMiddleware, canvasController.getCanvases);

// POST /api/canvases - Create new canvas
router.post('/', authMiddleware, canvasCreationLimiter, validateCanvas, canvasController.createCanvas);

// GET /api/canvases/:id - Get specific canvas
router.get('/:id', authMiddleware, canvasController.getCanvas);

// PUT /api/canvases/:id - Update canvas
router.put('/:id', authMiddleware, validateCanvas, canvasController.updateCanvas);

// DELETE /api/canvases/:id - Delete canvas
router.delete('/:id', authMiddleware, canvasController.deleteCanvas);

// POST /api/canvases/:id/duplicate - Duplicate canvas
router.post('/:id/duplicate', authMiddleware, canvasController.duplicateCanvas);

// POST /api/canvases/:id/rotate-token - Rotate share token
router.post('/:id/rotate-token', authMiddleware, canvasController.rotateShareToken);

// POST /api/canvases/:id/tags - Add tag to canvas
router.post('/:id/tags', authMiddleware, canvasController.addTagToCanvas);

// DELETE /api/canvases/:id/tags/:tagId - Remove tag from canvas
router.delete('/:id/tags/:tagId', authMiddleware, canvasController.removeTagFromCanvas);

export default router;
