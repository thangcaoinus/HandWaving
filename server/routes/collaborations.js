import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { validateAddCollaborator, validateUpdateRole } from '../utils/validation.js';
import * as collaborationController from '../controllers/collaborationController.js';

const router = Router();

// POST /api/canvases/:canvasId/join - Auto-join canvas via link (OPTIONAL auth - guests allowed)
router.post('/:canvasId/join', optionalAuthMiddleware, collaborationController.autoJoinCanvas);

// All other collaboration routes require authentication
router.use(authMiddleware);

// GET /api/canvases/:canvasId/collaborators - List collaborators
router.get('/:canvasId/collaborators', collaborationController.listCollaborators);

// POST /api/canvases/:canvasId/collaborators - Add collaborator
router.post('/:canvasId/collaborators', validateAddCollaborator, collaborationController.addCollaborator);

// PATCH /api/canvases/:canvasId/collaborators/:collaborationId - Update role
router.patch('/:canvasId/collaborators/:collaborationId', validateUpdateRole, collaborationController.updateCollaboratorRole);

// DELETE /api/canvases/:canvasId/collaborators/:collaborationId - Remove collaborator
router.delete('/:canvasId/collaborators/:collaborationId', collaborationController.removeCollaborator);

export default router;
