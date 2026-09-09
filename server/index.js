import { validTextState } from '../shared/textBox.js';
import { validImageState } from '../shared/imageObject.js';
// Socket.IO server - handles real-time collaboration with room management and operation broadcasting.
// Room lifecycle: join with auth/invite token → load canvas from DB → broadcast as operations → cleanup on disconnect.

import 'dotenv/config';
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "./config/prisma.js";
import authRoutes from "./routes/auth.js";
import canvasRoutes from "./routes/canvases.js";
import collaborationRoutes from "./routes/collaborations.js";
import userRoutes from "./routes/users.js";
import { errorHandler } from "./middleware/errorHandler.js";
import logger from "./utils/logger.js";

const app = express();
const server = createServer(app);

// Trust proxy - Railway/Render/Vercel use reverse proxies, need this to get real client IPs
app.set('trust proxy', 1);

// CORS configuration - uses CLIENT_URL from env, falls back to localhost for development
const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL]
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware
// Security headers (helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", ...allowedOrigins],
      imgSrc: ["'self'", "data:", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding canvas images
}));

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '120mb' })); // Support user storage limit (100MB canvas + overhead)

// Health check endpoint (for monitoring/load balancers)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/canvases', canvasRoutes);
app.use('/api/canvases', collaborationRoutes);

const rooms = new Map();
const anonymousDisconnectTimers = new Map(); // Track disconnect grace periods for anonymous users

// Helper: Verify JWT and get user
async function verifySocketAuth(token) {
  try {
    if (!token) return null;
    
    // Verify JWT signature
    jwt.verify(token, process.env.JWT_SECRET);
    
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true }
    });
    
    if (!session || session.expiresAt < new Date()) {
      return null;
    }
    
    return session.user;
  } catch (error) {
    logger.error('Socket authentication failed', { error: error.message });
    return null;
  }
}

// Helper: Check if user can access canvas
async function canAccessCanvas(userId, canvasId) {
  try {
    const canvas = await prisma.canvas.findUnique({
      where: { id: canvasId },
      include: {
        collaborations: {
          where: { userId }
        }
      }
    });
    
    if (!canvas) return { canAccess: false, role: null };
    
    // Owner has full access
    if (canvas.ownerId === userId) {
      return { canAccess: true, role: 'OWNER' };
    }
    
    // Check collaboration
    const collaboration = canvas.collaborations[0];
    if (collaboration) {
      return { canAccess: true, role: collaboration.role };
    }
    
    // Public canvas - anyone can view
    if (canvas.isPublic) {
      return { canAccess: true, role: 'VIEWER' };
    }

    return { canAccess: false, role: null };
  } catch (error) {
    logger.error('Canvas access check failed', {
      error: error.message,
      canvasId: logger.sanitizeId(canvasId)
    });
    return { canAccess: false, role: null };
  }
}

io.on("connection", (socket) => {
  logger.debug('Socket connected', { socketId: logger.sanitizeSocketId(socket.id) });

  socket.on("join:room", async ({ roomId, token, anonymousId, anonymousUsername, shareToken }) => {
    let user;
    let role;
    let isAnonymous = false;

    // Path 1: Authenticated user with JWT token
    if (token) {
      user = await verifySocketAuth(token);
      if (!user) {
        socket.emit("room:error", {
          message: "Invalid token - please log in again"
        });
        logger.warn('Socket authentication failed for room', {
          socketId: logger.sanitizeSocketId(socket.id),
          canvasId: logger.sanitizeId(roomId)
        });
        return;
      }

      // Check canvas permission
      const accessCheck = await canAccessCanvas(user.id, roomId);
      if (!accessCheck.canAccess) {
        socket.emit("room:error", {
          message: "You do not have permission to access this canvas"
        });
        logger.warn('Canvas access denied', {
          user: logger.sanitizeUser(user),
          canvasId: logger.sanitizeId(roomId)
        });
        return;
      }
      role = accessCheck.role;
    }
    // Path 2: Anonymous user with share link
    else if (anonymousId && shareToken) {
      // Validate share link
      const canvas = await prisma.canvas.findFirst({
        where: {
          id: roomId,
          linkSharingEnabled: true,
          shareToken: shareToken
        }
      });

      if (!canvas) {
        socket.emit("room:error", {
          message: "Invalid share link or link sharing disabled"
        });
        logger.warn('Invalid share link for anonymous user', {
          anonymousId: logger.sanitizeId(anonymousId),
          canvasId: logger.sanitizeId(roomId)
        });
        return;
      }

      // Create pseudo-user object (not in DB)
      user = {
        id: anonymousId,
        username: anonymousUsername || `Anon-${anonymousId.slice(0, 4)}`,
        displayName: anonymousUsername || `Anon-${anonymousId.slice(0, 4)}`,
        avatarUrl: null,
        isAnonymous: true
      };
      role = canvas.shareRole; // Use canvas default role
      isAnonymous = true;
      logger.debug('Anonymous user joining canvas', {
        user: logger.sanitizeUser(user),
        anonymousId: logger.sanitizeId(anonymousId),
        canvasId: logger.sanitizeId(roomId)
      });
    }
    else {
      socket.emit("room:error", {
        message: "Authentication required - please log in or use a share link"
      });
      return;
    }

    // Check if user is already in this room (for anonymous, check by anonymousId)
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (isAnonymous) {
        // Cancel disconnect timer if rejoining during grace period
        if (anonymousDisconnectTimers.has(anonymousId)) {
          clearTimeout(anonymousDisconnectTimers.get(anonymousId));
          anonymousDisconnectTimers.delete(anonymousId);
          logger.debug('Anonymous user rejoined during grace period', {
            anonymousId: logger.sanitizeId(anonymousId)
          });
        }

        // For anonymous, check if anonymousId already exists
        for (const [existingSocketId, userData] of room.users) {
          if (userData.userId === anonymousId) {
            // Already in room, just update socket ID (reconnection case)
            room.users.delete(existingSocketId);
            logger.debug('Anonymous user reconnecting, updating socket', {
              anonymousId: logger.sanitizeId(anonymousId),
              oldSocketId: logger.sanitizeSocketId(existingSocketId),
              newSocketId: logger.sanitizeSocketId(socket.id)
            });
            break;
          }
        }
      } else if (room.users.has(socket.id)) {
        logger.debug('Socket already in room, ignoring duplicate join', {
          socketId: logger.sanitizeSocketId(socket.id),
          canvasId: logger.sanitizeId(roomId)
        });
        return;
      }
    }

    socket.join(roomId);

    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      // Try to load canvas data from DB to populate operations
      let initialOperations = [];

      try {
        const canvas = await prisma.canvas.findUnique({
          where: { id: roomId },
          select: { data: true }
        });

        if (canvas?.data?.strokes) {
          // Replay each persisted object as the op that recreates it. Three object types now:
          // text -> TEXT_ADD, image -> IMAGE_ADD, everything else -> STROKE_ADD. Miscategorizing an
          // image as STROKE_ADD would drop its src, so the image branch is required.
          initialOperations = canvas.data.strokes.map(stroke => {
            const base = {
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              userId: stroke.userId || 'system',
              username: stroke.username || 'System',
              inverse: null,
            };
            if (stroke.type === 'text') {
              return { ...base, type: 'TEXT_ADD',
                payload: { textId: stroke.id, text: stroke.text, x: stroke.x, y: stroke.y, fontSize: stroke.fontSize, config: stroke.config, attachedTo: stroke.attachedTo } };
            }
            if (stroke.type === 'image') {
              return { ...base, type: 'IMAGE_ADD',
                payload: { imageId: stroke.id, src: stroke.src, x: stroke.x, y: stroke.y, width: stroke.width, height: stroke.height, config: stroke.config, attachedTo: stroke.attachedTo } };
            }
            return { ...base, type: 'STROKE_ADD',
              payload: { strokeId: stroke.id, points: stroke.points, config: stroke.config } };
          });
          logger.info('Canvas data loaded from database', {
            strokeCount: initialOperations.length,
            canvasId: logger.sanitizeId(roomId)
          });
        }
      } catch (error) {
        logger.error('Failed to load canvas data from database', {
          error: error.message,
          canvasId: logger.sanitizeId(roomId)
        });
        // Continue with empty operations if DB load fails
      }

      rooms.set(roomId, {
        users: new Map(),
        operations: initialOperations,
        ongoingStrokes: new Map()
      });
    }

    const room = rooms.get(roomId);
    room.users.set(socket.id, {
      id: socket.id,
      userId: user.id,
      username: user.displayName || user.username,
      avatarUrl: user.avatarUrl || null,
      role: role,
      isAnonymous: isAnonymous,
      cursor: null
    });

    socket.emit("room:joined", {
      roomId,
      operations: room.operations || [],
      users: Array.from(room.users.values()),
      userInfo: {
        userId: user.id,
        username: user.displayName || user.username,
        role: role,
        isAnonymous: isAnonymous
      }
    });

    socket.to(roomId).emit("user:joined", {
      id: socket.id,
      userId: user.id,
      username: user.displayName || user.username,
      avatarUrl: user.avatarUrl || null,
      role: role,
      isAnonymous: isAnonymous
    });

    logger.info('User joined room', {
      socketId: logger.sanitizeSocketId(socket.id),
      user: logger.sanitizeUser(user),
      canvasId: logger.sanitizeId(roomId),
      role,
      isAnonymous
    });
  });

  socket.on("left:room", ({ currentRoom, userId }) => {
    // Check if user is actually in the room before trying to leave
    if (
      !currentRoom ||
      !rooms.has(currentRoom) ||
      !rooms.get(currentRoom).users.has(userId)
    ) {
      logger.debug('User not in room, ignoring leave request', {
        userId: logger.sanitizeId(userId),
        canvasId: logger.sanitizeId(currentRoom)
      });
      return;
    }

    const room = rooms.get(currentRoom);
    room.users.delete(userId);
    socket.leave(currentRoom);

    io.to(currentRoom).emit("user:left", { id: userId });

    logger.debug('User left room', {
      userId: logger.sanitizeId(userId),
      canvasId: logger.sanitizeId(currentRoom)
    });

    // Delete room if empty
    if (room.users.size === 0) {
      rooms.delete(currentRoom);
      logger.debug('Room deleted (empty)', {
        canvasId: logger.sanitizeId(currentRoom)
      });
    }
  });


  // Unified operation handler
  socket.on("operation", (data) => {
    const { roomId, operation } = data;

    logger.debug('Operation received', {
      operationType: operation.type,
      operationId: operation.id
    });

    // Validate operation
    if (!operation || !operation.id || !operation.type || !operation.timestamp) {
      logger.error('Invalid operation received', {
        operation: operation ? { id: operation.id, type: operation.type } : null
      });
      return;
    }

    // Text operations carry RAW Markdown/LaTeX source. We deliberately do NOT strip
    // <, >, & anymore — they're meaningful (inequalities, matrix/align `&` separators,
    // escapes) and stripping them corrupts math. XSS is prevented at client render time
    // (markdown-it html:false escapes raw HTML; KaTeX trust:false blocks \href js:).
    // Server keeps only the type guard + a length cap as a DoS guard.
    if (operation.type === 'TEXT_ADD' || operation.type === 'TEXT_EDIT') {
      const textField = operation.type === 'TEXT_ADD' ? 'text' : 'newText';
      let text = operation.payload[textField];

      if (typeof text !== 'string') {
        logger.error('Invalid text in operation', {
          operationType: operation.type,
          textType: typeof text
        });
        return;
      }

      // Length limit (10,000 chars) — DoS guard only
      if (text.length > 10000) {
        text = text.substring(0, 10000);
        operation.payload[textField] = text;
      }
    }

    if (operation.type === 'TEXT_UPDATE' &&
        (!Array.isArray(operation.payload?.updates) || !operation.payload.updates.length || operation.payload.updates.length > 5000 ||
         !operation.payload.updates.every(u => u && typeof u.textId === 'string' && validTextState(u.after) && validTextState(u.before)))) return;
    if (operation.type === 'TEXT_ADD' && !validTextState(operation.payload)) return;

    // Images carry a base64 data URI. validImageState enforces the data:image/ prefix, a length cap
    // (DoS guard), and finite geometry. The `default` switch case below would otherwise broadcast an
    // IMAGE_ADD unvalidated, so this gate is required — not optional.
    if (operation.type === 'IMAGE_ADD' && !validImageState(operation.payload)) return;

    const room = rooms.get(roomId);
    if (!room) {
      logger.warn('Operation received for non-existent room', {
        canvasId: logger.sanitizeId(roomId)
      });
      return;
    }

    if (['TEXT_ADD', 'TEXT_EDIT', 'TEXT_DELETE', 'TEXT_UPDATE', 'IMAGE_ADD', 'IMAGE_DELETE'].includes(operation.type)) {
      const member = room.users.get(socket.id);
      if (!member || member.role === 'VIEWER') return;
      operation.userId = member.userId;
      operation.username = member.username;
    }

    // Handle operation based on type
    switch (operation.type) {
      case 'STROKE_START':
        // Store ongoing stroke for new users
        room.ongoingStrokes.set(operation.payload.strokeId, {
          ...operation.payload,
          userId: socket.id,
          timestamp: operation.timestamp
        });
        break;

      case 'STROKE_PROGRESS': {
        const ongoingStroke = room.ongoingStrokes.get(operation.payload.strokeId);
        if (ongoingStroke) {
          if (!ongoingStroke.points) {
            ongoingStroke.points = [ongoingStroke.point];
          }
          ongoingStroke.points.push(operation.payload.point);
        }
        break;
      }

      case 'STROKE_ADD':
        // Remove from ongoing strokes and add to operation history
        room.ongoingStrokes.delete(operation.payload.strokeId);
        room.operations.push({
          ...operation,
          receivedAt: Date.now()
        });
        break;

      case 'STROKE_DELETE':
      case 'STROKE_MOVE':
      case 'STROKE_UNDO':
      case 'STROKE_RESIZE':
      case 'STROKE_ROTATE':
      case 'BATCH_ADD_STROKES':
      case 'BATCH_DELETE_STROKES':
      case 'TEXT_UPDATE':
      case 'TEXT_ADD':
      case 'TEXT_EDIT':
      case 'TEXT_DELETE':
      case 'IMAGE_ADD':
      case 'IMAGE_DELETE':
        // Add to operation history
        room.operations.push({
          ...operation,
          receivedAt: Date.now()
        });
        break;

      default:
        logger.warn('Unknown operation type received', {
          operationType: operation.type,
          operationId: operation.id
        });
        // Still broadcast unknown operations - let clients decide
        room.operations.push({
          ...operation,
          receivedAt: Date.now()
        });
    }

    // Keep only last 1000 operations to prevent memory growth
    if (room.operations.length > 1000) {
      room.operations = room.operations.slice(-1000);
    }

    // Broadcast operation to other users in the room
    socket.to(roomId).emit("operation", { operation });

    logger.debug('Operation broadcasted', {
      operationType: operation.type,
      canvasId: logger.sanitizeId(roomId)
    });
  });

  socket.on("cursor:move", (data) => {
    const { roomId, position } = data;
    const room = rooms.get(roomId);

    if (room && room.users.has(socket.id)) {
      room.users.get(socket.id).cursor = position;
      socket.to(roomId).emit("cursor:move", {
        userId: socket.id,
        position,
      });
    }
  });

  // Change anonymous user role (owner only)
  socket.on("change-anonymous-role", async ({ canvasId, anonymousId, newRole, token }) => {
    try {
      // Verify requester is owner
      const requesterUser = await verifySocketAuth(token);
      if (!requesterUser) {
        socket.emit("room:error", { message: "Authentication required" });
        return;
      }

      const canvas = await prisma.canvas.findUnique({
        where: { id: canvasId }
      });

      if (!canvas || canvas.ownerId !== requesterUser.id) {
        socket.emit("room:error", { message: "Only canvas owner can change roles" });
        return;
      }

      // Update role in room state
      const room = rooms.get(canvasId);
      if (!room) {
        socket.emit("room:error", { message: "Room not found" });
        return;
      }

      // Find anonymous user's socket by anonymousId
      let targetSocketId = null;
      for (const [sid, userData] of room.users) {
        if (userData.userId === anonymousId && userData.isAnonymous) {
          userData.role = newRole;
          targetSocketId = sid;
          logger.info('Owner changed anonymous user role', {
            anonymousId: logger.sanitizeId(anonymousId),
            newRole
          });
          break;
        }
      }

      if (targetSocketId) {
        // Emit permission-changed to that specific anonymous user
        io.to(targetSocketId).emit("permission-changed", {
          canvasId,
          newRole,
          message: `Your role was changed to ${newRole} by canvas owner`
        });

        // Notify all users in room about role change
        io.to(canvasId).emit("user:role-changed", {
          userId: anonymousId,
          newRole
        });
      } else {
        socket.emit("room:error", { message: "Anonymous user not found in room" });
      }
    } catch (error) {
      logger.error('Failed to change anonymous user role', {
        error: error.message,
        canvasId: logger.sanitizeId(canvasId)
      });
      socket.emit("room:error", { message: "Failed to change role" });
    }
  });

  socket.on("disconnect", () => {
    logger.debug('Socket disconnected', {
      socketId: logger.sanitizeSocketId(socket.id)
    });

    for (const [roomId, room] of rooms) {
      if (room.users.has(socket.id)) {
        const userData = room.users.get(socket.id);

        // Anonymous users get 30s grace period before removal
        if (userData.isAnonymous) {
          const anonymousId = userData.userId;
          logger.debug('Anonymous user disconnected, starting grace period', {
            anonymousId: logger.sanitizeId(anonymousId)
          });

          // Set timer to remove user after 30s
          const timerId = setTimeout(() => {
            // Check if user is still disconnected (not rejoined)
            for (const [rid, r] of rooms) {
              if (r.users.has(socket.id)) {
                r.users.delete(socket.id);

                // Clean up ongoing strokes
                for (const [strokeId, stroke] of r.ongoingStrokes) {
                  if (stroke.userId === socket.id) {
                    r.ongoingStrokes.delete(strokeId);
                  }
                }

                io.to(rid).emit("user:left", { id: socket.id });
                logger.debug('Anonymous user removed after grace period', {
                  anonymousId: logger.sanitizeId(anonymousId)
                });

                if (r.users.size === 0) {
                  rooms.delete(rid);
                  logger.debug('Room deleted after anonymous user removal', {
                    canvasId: logger.sanitizeId(rid)
                  });
                }
              }
            }
            anonymousDisconnectTimers.delete(anonymousId);
          }, 30000);

          anonymousDisconnectTimers.set(anonymousId, timerId);
        } else {
          // Regular authenticated users leave immediately
          room.users.delete(socket.id);

          // Clean up ongoing strokes
          for (const [strokeId, stroke] of room.ongoingStrokes) {
            if (stroke.userId === socket.id) {
              room.ongoingStrokes.delete(strokeId);
            }
          }

          socket.to(roomId).emit("user:left", { id: socket.id });

          if (room.users.size === 0) {
            rooms.delete(roomId);
            logger.debug('Room deleted after user disconnect', {
              canvasId: logger.sanitizeId(roomId)
            });
          }
        }
      }
    }
  });
});

// Error handler middleware (must be last!)
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    authEndpoint: `/api/auth`,
    logLevel: logger.level
  });
  logger.info(`🎨 Collaboration server running on port ${PORT}`);
  logger.info(`📡 Auth API available at http://localhost:${PORT}/api/auth`);
});

// Export io and rooms for use in controllers
export { io, rooms };
