// Collaboration controller - manages canvas collaborators (add/remove/update roles).
// Only Owner and ADMIN can modify. Broadcasts permission changes via Socket.IO.

import { validationResult } from "express-validator";
import crypto from "crypto";
import prisma from "../config/prisma.js";
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
  ConflictError,
} from "../utils/errors.js";
import { io, rooms } from "../index.js";
import logger from "../utils/logger.js";

function checkValidationErrors(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError("Validation failed", errors.array());
  }
}

// Helper: Find socket ID for a user in a room
function findUserSocketId(canvasId, userId) {
  const room = rooms.get(canvasId);
  if (!room) return null;

  for (const [socketId, userData] of room.users.entries()) {
    if (userData.userId === userId) {
      return socketId;
    }
  }
  return null;
}

// Add collaborator to canvas
export async function addCollaborator(req, res, next) {
  try {
    checkValidationErrors(req);

    const { canvasId } = req.params;
    const { email, role = "VIEWER" } = req.body;
    const userId = req.user.id;

    const canvas = await prisma.canvas.findUnique({
      where: { id: canvasId },
    });

    if (!canvas) {
      throw new NotFoundError("Canvas not found");
    }

    // Only owner or ADMIN can add collaborators
    const isOwner = canvas.ownerId === userId;
    const existingCollab = await prisma.collaboration.findUnique({
      where: {
        canvasId_userId: { canvasId, userId },
      },
    });
    const isAdmin = existingCollab && existingCollab.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      throw new AuthorizationError(
        "Only owner or admins can add collaborators"
      );
    }

    // Find user by email
    const userToAdd = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isGuest: true,
      },
    });

    if (!userToAdd) {
      throw new NotFoundError("User not found with that email");
    }

    // SECURITY: Guests cannot be ADMIN
    if (userToAdd.isGuest && role === "ADMIN") {
      throw new ValidationError("Guest users cannot be given ADMIN role");
    }

    // Can't add owner as collaborator
    if (userToAdd.id === canvas.ownerId) {
      throw new ValidationError("Cannot add canvas owner as collaborator");
    }

    // Check if already a collaborator
    const existing = await prisma.collaboration.findUnique({
      where: {
        canvasId_userId: { canvasId, userId: userToAdd.id },
      },
    });

    if (existing) {
      throw new ConflictError("User is already a collaborator");
    }

    // Add collaboration
    const collaboration = await prisma.collaboration.create({
      data: {
        canvasId,
        userId: userToAdd.id,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isGuest: true,
          },
        },
      },
    });

    // Broadcast to room that collaborator list changed (for UI refresh)
    io.to(canvasId).emit("collaborators-changed", {
      canvasId,
      action: "added",
      userId: userToAdd.id,
      role: role,
    });

    res.status(201).json({ collaboration });
  } catch (error) {
    next(error);
  }
}

// Remove collaborator from canvas
export async function removeCollaborator(req, res, next) {
  try {
    const { canvasId, collaborationId } = req.params;
    const userId = req.user.id;

    const canvas = await prisma.canvas.findUnique({
      where: { id: canvasId },
    });

    if (!canvas) {
      throw new NotFoundError("Canvas not found");
    }

    const collaboration = await prisma.collaboration.findUnique({
      where: { id: collaborationId },
    });

    if (!collaboration || collaboration.canvasId !== canvasId) {
      throw new NotFoundError("Collaboration not found");
    }

    // Only owner or ADMIN can remove collaborators
    const isOwner = canvas.ownerId === userId;
    const userCollab = await prisma.collaboration.findUnique({
      where: {
        canvasId_userId: { canvasId, userId },
      },
    });
    const isAdmin = userCollab && userCollab.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      throw new AuthorizationError(
        "Only owner or admins can remove collaborators"
      );
    }

    await prisma.collaboration.delete({
      where: { id: collaborationId },
    });

    // Emit Socket.IO event to kick the user
    const targetSocketId = findUserSocketId(canvasId, collaboration.userId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("access-revoked", {
        canvasId,
        message: "Your access to this canvas has been revoked",
      });
      logger.info('Access revoked notification sent', {
        userId: logger.sanitizeId(collaboration.userId),
        canvasId: logger.sanitizeId(canvasId)
      });
    }

    // Broadcast to room that collaborator list changed (for UI refresh)
    io.to(canvasId).emit("collaborators-changed", {
      canvasId,
      action: "removed",
      userId: collaboration.userId,
    });

    res.json({ message: "Collaborator removed" });
  } catch (error) {
    next(error);
  }
}

// Update collaborator role
export async function updateCollaboratorRole(req, res, next) {
  try {
    checkValidationErrors(req);

    const { canvasId, collaborationId } = req.params;
    const { role } = req.body;
    const userId = req.user.id;

    const canvas = await prisma.canvas.findUnique({
      where: { id: canvasId },
    });

    if (!canvas) {
      throw new NotFoundError("Canvas not found");
    }

    // Only owner can change roles
    if (canvas.ownerId !== userId) {
      throw new AuthorizationError(
        "Only the owner can change collaborator roles"
      );
    }

    const collaboration = await prisma.collaboration.findUnique({
      where: { id: collaborationId },
      include: {
        user: {
          select: {
            id: true,
            isGuest: true,
          },
        },
      },
    });

    if (!collaboration || collaboration.canvasId !== canvasId) {
      throw new NotFoundError("Collaboration not found");
    }

    // SECURITY: Guests cannot be ADMIN
    if (collaboration.user.isGuest && role === "ADMIN") {
      throw new ValidationError("Guest users cannot be given ADMIN role");
    }

    const updated = await prisma.collaboration.update({
      where: { id: collaborationId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isGuest: true,
          },
        },
      },
    });

    // Emit Socket.IO event to notify the user
    const targetSocketId = findUserSocketId(canvasId, collaboration.userId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("permission-changed", {
        canvasId,
        newRole: role,
        message: `Your role has been changed to ${role}`,
      });
      logger.info('Permission change notification sent', {
        userId: logger.sanitizeId(collaboration.userId),
        canvasId: logger.sanitizeId(canvasId),
        newRole: role
      });
    }

    // Broadcast to room that collaborator list changed (for UI refresh)
    io.to(canvasId).emit("collaborators-changed", {
      canvasId,
      action: "role-updated",
      userId: collaboration.userId,
      newRole: role,
    });

    res.json({ collaboration: updated });
  } catch (error) {
    next(error);
  }
}

// List collaborators for a canvas
export async function listCollaborators(req, res, next) {
  try {
    const { canvasId } = req.params;
    const userId = req.user.id;

    const canvas = await prisma.canvas.findUnique({
      where: { id: canvasId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        collaborations: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                isGuest: true,
              },
            },
          },
        },
      },
    });

    if (!canvas) {
      throw new NotFoundError("Canvas not found");
    }

    // Check access
    const isOwner = canvas.ownerId === userId;
    const isCollaborator = canvas.collaborations.some(
      (c) => c.userId === userId
    );
    const canAccess = canvas.isPublic || isOwner || isCollaborator;

    if (!canAccess) {
      throw new AuthorizationError("You do not have access to this canvas");
    }

    res.json({
      owner: canvas.owner,
      collaborators: canvas.collaborations,
    });
  } catch (error) {
    next(error);
  }
}

// Auto-join canvas via link (authenticated users only - anonymous users join via Socket.IO)
export async function autoJoinCanvas(req, res, next) {
  try {
    const { canvasId } = req.params;
    const { invite: shareToken } = req.query;
    const userId = req.user?.id;

    const canvas = await prisma.canvas.findUnique({
      where: { id: canvasId },
    });

    if (!canvas) {
      throw new NotFoundError("Canvas not found");
    }

    // SECURITY: If no authenticated user, share token is REQUIRED
    if (!userId && !shareToken) {
      throw new AuthorizationError(
        "Share token required for unauthenticated access"
      );
    }

    // If share token provided, validate it
    if (shareToken) {
      if (!canvas.linkSharingEnabled) {
        throw new AuthorizationError(
          "Link sharing is disabled for this canvas"
        );
      }

      if (canvas.shareToken !== shareToken) {
        throw new AuthorizationError("Invalid share token");
      }

      // Check token expiry
      if (
        canvas.tokenExpiresAt &&
        new Date(canvas.tokenExpiresAt) < new Date()
      ) {
        // Token expired - auto-rotate it
        const newToken = crypto.randomUUID();
        const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await prisma.canvas.update({
          where: { id: canvasId },
          data: {
            shareToken: newToken,
            tokenExpiresAt: newExpiry,
          },
        });

        return res.status(410).json({
          error: "Token expired",
          rotated: true,
          newToken,
          message: "Share token has expired. Please use the new link.",
        });
      }
    }

    // AUTHENTICATED USER PATH (anonymous users join via Socket.IO, not this endpoint)
    if (!userId) {
      throw new AuthorizationError("Authentication required");
    }

    // Check if user is owner
    if (canvas.ownerId === userId) {
      return res.json({
        message: "You are the owner of this canvas",
        role: "OWNER",
        alreadyMember: true,
      });
    }

    // Check if user is already a collaborator
    const existingCollab = await prisma.collaboration.findUnique({
      where: {
        canvasId_userId: { canvasId, userId },
      },
    });

    if (existingCollab) {
      return res.json({
        message: "You are already a collaborator",
        role: existingCollab.role,
        alreadyMember: true,
      });
    }

    // SECURITY: If not owner and not already a collaborator, share token is REQUIRED
    if (!shareToken) {
      throw new AuthorizationError("Share token required to join this canvas");
    }

    // Auto-add with role from canvas.shareRole
    const role = canvas.shareRole || "EDITOR";

    const collaboration = await prisma.collaboration.create({
      data: {
        canvasId,
        userId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isGuest: true,
          },
        },
      },
    });

    // Broadcast to room that collaborator list changed
    io.to(canvasId).emit("collaborators-changed", {
      canvasId,
      action: "joined",
      userId,
      role,
    });

    res.status(201).json({
      message: `Successfully joined canvas as ${role}`,
      collaboration,
      role,
      alreadyMember: false,
    });
  } catch (error) {
    next(error);
  }
}
