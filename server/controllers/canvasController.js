// Canvas controller - CRUD operations for canvases with permission checks and collaboration support.
// Handles share links, tag management, duplicate, export. Auto-updates lastAccessedAt on load.

import { validationResult } from 'express-validator';
import crypto from 'crypto';
import prisma from '../config/prisma.js';
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
} from '../utils/errors.js';
import { io } from '../index.js';
import logger from '../utils/logger.js';

// Helper to check validation results
function checkValidationErrors(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }
}

// Helper to check user's storage limit
async function checkUserStorageLimit(userId, newDataSize, excludeCanvasId = null) {
  const MAX_USER_STORAGE = 100 * 1024 * 1024; // 100MB per user

  // Get all user's canvases to calculate total storage
  const userCanvases = await prisma.canvas.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { collaborations: { some: { userId, role: { in: ['EDITOR', 'ADMIN'] } } } }
      ]
    },
    select: { id: true, data: true }
  });

  // Calculate total storage (excluding canvas being updated if specified)
  let totalStorage = 0;
  for (const userCanvas of userCanvases) {
    if (!excludeCanvasId || userCanvas.id !== excludeCanvasId) {
      totalStorage += JSON.stringify(userCanvas.data).length;
    }
  }

  // Add new data size
  totalStorage += newDataSize;

  if (totalStorage > MAX_USER_STORAGE) {
    const usedMB = (totalStorage / 1024 / 1024).toFixed(2);
    const limitMB = (MAX_USER_STORAGE / 1024 / 1024);
    throw new ValidationError(
      `Storage limit exceeded. You have used ${usedMB}MB of ${limitMB}MB limit. ` +
      `Please delete some canvases or reduce canvas size.`
    );
  }

  return totalStorage;
}

// Create new canvas
export async function createCanvas(req, res, next) {
  try {
    checkValidationErrors(req);

    const { title, description, data } = req.body;
    const userId = req.user.id;

    // Validation is handled by middleware, but double-check data structure
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Canvas data must be a valid object');
    }

    // Check user's storage limit before creating new canvas
    const newDataSize = JSON.stringify(data).length;
    await checkUserStorageLimit(userId, newDataSize);

    const canvas = await prisma.canvas.create({
      data: {
        title: title || 'Untitled Canvas',
        description: description || null,
        data: data,
        ownerId: userId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        data: true,
        thumbnailUrl: true,
        isPublic: true,
        isTemplate: true,
        shareToken: true,
        linkSharingEnabled: true,
        shareRole: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        lastAccessedAt: true,
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    logger.info('Canvas created', {
      canvasId: canvas.id,
      userId: userId,
      title: canvas.title,
      strokeCount: canvas.data?.strokes?.length || 0
    });

    res.status(201).json({ canvas });
  } catch (error) {
    next(error);
  }
}

// Get user's canvases (list view - without full data)
export async function getCanvases(req, res, next) {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, sortBy = 'updatedAt', order = 'desc' } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause - show owned canvases and canvases shared with user
    const where = {
      OR: [
        { ownerId: userId },
        {
          collaborations: {
            some: {
              userId: userId,
            },
          },
        },
      ],
    };

    // Get canvases
    const canvases = await prisma.canvas.findMany({
      where,
      skip,
      take,
      orderBy: {
        [sortBy]: order,
      },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        isPublic: true,
        isTemplate: true,
        createdAt: true,
        updatedAt: true,
        lastAccessedAt: true,
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        // Don't include full data in list view for performance
      },
    });

    // Get total count for pagination
    const total = await prisma.canvas.count({ where });

    res.json({
      canvases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
}

// Get single canvas with full data
export async function getCanvas(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const canvas = await prisma.canvas.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        collaborations: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!canvas) {
      throw new NotFoundError('Canvas not found');
    }

    // Check access permissions
    const isOwner = canvas.ownerId === userId;
    const isCollaborator = canvas.collaborations.some(
      (collab) => collab.userId === userId
    );
    const canAccess = canvas.isPublic || isOwner || isCollaborator;

    if (!canAccess) {
      throw new AuthorizationError('You do not have access to this canvas');
    }

    // Update last accessed time
    await prisma.canvas.update({
      where: { id },
      data: { lastAccessedAt: new Date() },
    });

    res.json({ canvas });
  } catch (error) {
    next(error);
  }
}

// Update canvas
export async function updateCanvas(req, res, next) {
  try {
    checkValidationErrors(req);
    
    const { id } = req.params;
    const userId = req.user.id;
    const { title, description, data, isPublic, linkSharingEnabled, shareRole } = req.body;

    // Find canvas and check permissions
    const canvas = await prisma.canvas.findUnique({
      where: { id },
      include: {
        collaborations: {
          where: { userId },
        },
      },
    });

    if (!canvas) {
      throw new NotFoundError('Canvas not found');
    }

    // Check if user has edit permission
    const isOwner = canvas.ownerId === userId;
    const isEditor = canvas.collaborations.some(
      (collab) => collab.role === 'EDITOR' || collab.role === 'ADMIN'
    );

    if (!isOwner && !isEditor) {
      throw new AuthorizationError('You do not have permission to edit this canvas');
    }

    // Check user's storage limit if updating data
    if (data !== undefined) {
      const newDataSize = JSON.stringify(data).length;
      await checkUserStorageLimit(userId, newDataSize, id);
    }

    // Build update data (only include provided fields)
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (data !== undefined) updateData.data = data;
    if (isPublic !== undefined) {
      // Only owner can change public status
      if (!isOwner) {
        throw new AuthorizationError('Only the owner can change public status');
      }
      updateData.isPublic = isPublic;
    }

    // Link sharing settings - only owner can change
    if (linkSharingEnabled !== undefined) {
      if (!isOwner) {
        throw new AuthorizationError('Only the owner can change link sharing settings');
      }
      updateData.linkSharingEnabled = linkSharingEnabled;
    }
    if (shareRole !== undefined) {
      if (!isOwner) {
        throw new AuthorizationError('Only the owner can change link sharing settings');
      }
      updateData.shareRole = shareRole;
    }

    const updatedCanvas = await prisma.canvas.update({
      where: { id },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    logger.info('Canvas updated', {
      canvasId: id,
      userId: req.user.id,
      strokeCount: updatedCanvas.data?.strokes?.length || 0,
      hasTitle: !!updateData.title,
      hasData: !!updateData.data
    });

    res.json({ canvas: updatedCanvas });
  } catch (error) {
    next(error);
  }
}

// Delete canvas
export async function deleteCanvas(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const canvas = await prisma.canvas.findUnique({
      where: { id },
    });

    if (!canvas) {
      throw new NotFoundError('Canvas not found');
    }

    // Only owner can delete
    if (canvas.ownerId !== userId) {
      throw new AuthorizationError('Only the owner can delete this canvas');
    }

    await prisma.canvas.delete({
      where: { id },
    });

    logger.info('Canvas deleted', {
      canvasId: id,
      userId: req.user.id
    });

    res.json({
      message: 'Canvas deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

// Duplicate canvas
export async function duplicateCanvas(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const sourceCanvas = await prisma.canvas.findUnique({
      where: { id },
      include: {
        collaborations: {
          where: { userId },
        },
      },
    });

    if (!sourceCanvas) {
      throw new NotFoundError('Canvas not found');
    }

    // Check if user has access to view the canvas
    const isOwner = sourceCanvas.ownerId === userId;
    const hasAccess = sourceCanvas.isPublic || isOwner || sourceCanvas.collaborations.length > 0;

    if (!hasAccess) {
      throw new AuthorizationError('You do not have access to this canvas');
    }

    // Create duplicate (new owner is current user)
    const duplicate = await prisma.canvas.create({
      data: {
        title: `${sourceCanvas.title} (Copy)`,
        description: sourceCanvas.description,
        data: sourceCanvas.data,
        ownerId: userId,
        isPublic: false, // Copies are private by default
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    res.status(201).json({ canvas: duplicate });
  } catch (error) {
    next(error);
  }
}

// Add tag to canvas
export async function addTagToCanvas(req, res, next) {
  try {
    const { id } = req.params;
    const { tagName } = req.body;
    const userId = req.user.id;

    // Validate tag name
    if (!tagName || typeof tagName !== 'string' || tagName.trim().length === 0) {
      throw new ValidationError('Tag name is required');
    }

    const trimmedTag = tagName.trim().toLowerCase();

    // Length validation
    if (trimmedTag.length < 1 || trimmedTag.length > 30) {
      throw new ValidationError('Tag name must be between 1 and 30 characters');
    }

    // Character validation - only alphanumeric, dash, underscore, space
    if (!/^[a-z0-9\s\-_]+$/.test(trimmedTag)) {
      throw new ValidationError('Tag name can only contain letters, numbers, spaces, hyphens, and underscores');
    }

    // Check canvas access
    const canvas = await prisma.canvas.findUnique({
      where: { id },
      include: {
        collaborations: { where: { userId } },
        tags: true, // Include existing tags
      },
    });

    if (!canvas) {
      throw new NotFoundError('Canvas not found');
    }

    const isOwner = canvas.ownerId === userId;
    const isEditor = canvas.collaborations.some(
      (collab) => collab.role === 'EDITOR' || collab.role === 'ADMIN'
    );

    if (!isOwner && !isEditor) {
      throw new AuthorizationError('You do not have permission to edit this canvas');
    }

    // Limit maximum tags per canvas
    const MAX_TAGS = 10;
    if (canvas.tags.length >= MAX_TAGS) {
      throw new ValidationError(`Canvas cannot have more than ${MAX_TAGS} tags`);
    }

    // Find or create tag
    let tag = await prisma.tag.findUnique({
      where: { name: trimmedTag },
    });

    if (!tag) {
      tag = await prisma.tag.create({
        data: { name: trimmedTag },
      });
    }

    // Check if tag already exists on canvas
    const existing = await prisma.canvasTag.findUnique({
      where: {
        canvasId_tagId: {
          canvasId: id,
          tagId: tag.id,
        },
      },
    });

    if (existing) {
      return res.json({ tag }); // Already tagged
    }

    // Add tag to canvas
    await prisma.canvasTag.create({
      data: {
        canvasId: id,
        tagId: tag.id,
      },
    });

    res.status(201).json({ tag });
  } catch (error) {
    next(error);
  }
}

// Remove tag from canvas
export async function removeTagFromCanvas(req, res, next) {
  try {
    const { id, tagId } = req.params;
    const userId = req.user.id;

    // Check canvas access
    const canvas = await prisma.canvas.findUnique({
      where: { id },
      include: {
        collaborations: { where: { userId } },
      },
    });

    if (!canvas) {
      throw new NotFoundError('Canvas not found');
    }

    const isOwner = canvas.ownerId === userId;
    const isEditor = canvas.collaborations.some(
      (collab) => collab.role === 'EDITOR' || collab.role === 'ADMIN'
    );

    if (!isOwner && !isEditor) {
      throw new AuthorizationError('You do not have permission to edit this canvas');
    }

    // Remove tag from canvas
    await prisma.canvasTag.delete({
      where: {
        canvasId_tagId: {
          canvasId: id,
          tagId,
        },
      },
    });

    res.json({ message: 'Tag removed successfully' });
  } catch (error) {
    next(error);
  }
}

// Rotate share token (invalidate old link, generate new one)
export async function rotateShareToken(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const canvas = await prisma.canvas.findUnique({
      where: { id },
    });

    if (!canvas) {
      throw new NotFoundError('Canvas not found');
    }

    // Only owner can rotate token
    if (canvas.ownerId !== userId) {
      throw new AuthorizationError('Only the owner can rotate the share token');
    }

    // Generate new token and set 24hr expiry
    const newToken = crypto.randomUUID();
    const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const updatedCanvas = await prisma.canvas.update({
      where: { id },
      data: {
        shareToken: newToken,
        tokenExpiresAt: newExpiry,
      },
      select: {
        id: true,
        shareToken: true,
        tokenExpiresAt: true,
        linkSharingEnabled: true,
        shareRole: true,
      },
    });

    // Kick all anonymous users from the room (token is now invalid)
    io.to(id).emit('share-token-rotated', {
      canvasId: id,
      message: 'The share link has been changed. Please use the new link to rejoin.',
    });

    res.json({
      message: 'Share token rotated successfully',
      canvas: updatedCanvas,
    });
  } catch (error) {
    next(error);
  }
}
