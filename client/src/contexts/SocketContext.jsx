// Socket.IO context - manages WebSocket connection, room state, user presence, real-time operations.
// Anonymous users get persistent IDs via localStorage. Operation handlers set via refs (immortal listeners).

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { SOCKET_URL } from "../config/api";
import { logger } from '../utils/logger';

const SocketContext = createContext();

function generateAnonymousName() {
  const adjectives = [
    'Anonymous', 'Mysterious', 'Secret', 'Hidden', 'Shy',
    'Quiet', 'Silent', 'Sneaky', 'Clever', 'Swift',
    'Quick', 'Bright', 'Cheerful', 'Happy', 'Jolly',
    'Merry', 'Playful', 'Curious'
  ];
  const animals = [
    'Platypus', 'Penguin', 'Otter', 'Raccoon', 'Fox',
    'Panda', 'Koala', 'Sloth', 'Hamster', 'Squirrel',
    'Hedgehog', 'Ferret', 'Capybara', 'Quokka',
    'Axolotl', 'Narwhal', 'Walrus', 'Dolphin',
    'Octopus', 'Turtle', 'Owl', 'Parrot', 'Flamingo'
  ];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adjective} ${animal}`;
}

function getOrCreateAnonymousId() {
  let anonymousId = localStorage.getItem('anonymousUserId');
  if (!anonymousId) {
    anonymousId = crypto.randomUUID();
    localStorage.setItem('anonymousUserId', anonymousId);
    logger.log('Generated new anonymous ID:', anonymousId);
  }
  return anonymousId;
}

function getOrCreateAnonymousUsername() {
  let username = localStorage.getItem('anonymousUsername');
  if (!username) {
    username = generateAnonymousName();
    localStorage.setItem('anonymousUsername', username);
    logger.log('Generated new anonymous username:', username);
  }
  return username;
}

// Deduplicate users by userId, preferring entries with avatarUrl
function deduplicateUsersByUserId(users) {
  const userMap = new Map();

  for (const user of users) {
    const userId = user.userId || user.id;
    const existing = userMap.get(userId);

    if (!existing || (user.avatarUrl && !existing.avatarUrl)) {
      userMap.set(userId, { ...user, userId });
    }
  }

  return Array.from(userMap.values());
}

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [users, setUsers] = useState([]);
  const [myUserInfo, setMyUserInfo] = useState(null);
  const { token } = useAuth();

  // Callback refs for operation/cursor handling - immortal listeners, handlers swap via refs
  const operationHandlerRef = useRef(null);
  const roomJoinedHandlerRef = useRef(null);
  const roomErrorHandlerRef = useRef(null);
  const permissionChangedHandlerRef = useRef(null);
  const accessRevokedHandlerRef = useRef(null);
  const collaboratorsChangedHandlerRef = useRef(null);
  const shareTokenRotatedHandlerRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);

    const socket = socketRef.current;

    socket.on("connect", () => {
      setIsConnected(true);
      logger.log("Connected to collaboration server");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      logger.log("Disconnected from server");
    });

    socket.on("room:joined", ({ roomId, users, userInfo, operations }) => {
      setCurrentRoom(roomId);
      // Store ALL users (including duplicates from multiple tabs)
      setUsers(users);
      setMyUserInfo(userInfo); // Store user's own role/info
      logger.log(`Joined canvas ${roomId} as ${userInfo?.role}`, userInfo);

      // Dispatch to registered handler (set by useCollaborativeStrokes)
      if (roomJoinedHandlerRef.current) {
        roomJoinedHandlerRef.current({ operations, userInfo });
      }
    });

    socket.on("room:error", ({ message }) => {
      logger.error("Room error:", message);
      if (roomErrorHandlerRef.current) {
        roomErrorHandlerRef.current({ message });
      } else {
        // Fallback if no handler registered
        alert(message);
      }
    });

    socket.on("user:joined", ({ id, userId, username, avatarUrl, role }) => {
      setUsers((prev) => [
        ...prev.filter((u) => u.id !== id),
        { id, userId, username, avatarUrl, role, cursor: null },
      ]);
      logger.log(`User ${username} (${role}) joined`);
    });

    socket.on("user:left", ({ id }) => {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    });

    // CRITICAL: Operation listener lives here, never re-attaches
    socket.on("operation", ({ operation }) => {
      if (operationHandlerRef.current) {
        operationHandlerRef.current({ operation });
      }
    });

    // Real-time permission events
    socket.on("permission-changed", ({ canvasId, newRole, message }) => {
      logger.log(`Permission changed: ${newRole}`, message);
      if (permissionChangedHandlerRef.current) {
        permissionChangedHandlerRef.current({ canvasId, newRole, message });
      }
    });

    socket.on("access-revoked", ({ canvasId, message }) => {
      logger.log(`Access revoked from canvas ${canvasId}:`, message);
      if (accessRevokedHandlerRef.current) {
        accessRevokedHandlerRef.current({ canvasId, message });
      }
    });

    // Collaborator list change event
    socket.on("collaborators-changed", ({ canvasId, action, userId, newRole }) => {
      logger.log(`Collaborators changed in canvas ${canvasId}:`, action);
      if (collaboratorsChangedHandlerRef.current) {
        collaboratorsChangedHandlerRef.current({ canvasId, action, userId, newRole });
      }
    });

    // Share token rotation event (kicks anonymous users)
    socket.on("share-token-rotated", ({ canvasId, message }) => {
      logger.log(`Share token rotated for canvas ${canvasId}:`, message);
      if (shareTokenRotatedHandlerRef.current) {
        shareTokenRotatedHandlerRef.current({ canvasId, message });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinRoom = (currentRoom, roomId, shareToken = null) => {
    if (socketRef.current && isConnected && currentRoom != roomId) {
      // If no token, use anonymous ID
      const payload = token
        ? { roomId, token, shareToken }
        : {
            roomId,
            token: null,
            anonymousId: getOrCreateAnonymousId(),
            anonymousUsername: getOrCreateAnonymousUsername(),
            shareToken
          };

      socketRef.current.emit("join:room", payload);

      if (currentRoom) {
        socketRef.current.emit("left:room", {
          currentRoom,
          userId: socketRef.current.id,
        });
      }
    }
  };

  const emitCursorMove = (position) => {
    if (socketRef.current && currentRoom) {
      socketRef.current.emit("cursor:move", {
        roomId: currentRoom,
        position,
      });
    }
  };

  // Unified operation broadcasting
  const emitOperation = (operation) => {
    if (socketRef.current && currentRoom) {
      socketRef.current.emit("operation", {
        roomId: currentRoom,
        operation,
      });
    }
  };

  // Allow components to register operation handlers (called once, stable)
  const registerOperationHandler = (handler) => {
    operationHandlerRef.current = handler;
  };

  const registerRoomJoinedHandler = (handler) => {
    roomJoinedHandlerRef.current = handler;
  };

  const registerRoomErrorHandler = (handler) => {
    roomErrorHandlerRef.current = handler;
  };

  const registerPermissionChangedHandler = (handler) => {
    permissionChangedHandlerRef.current = handler;
  };

  const registerAccessRevokedHandler = (handler) => {
    accessRevokedHandlerRef.current = handler;
  };

  const registerCollaboratorsChangedHandler = (handler) => {
    collaboratorsChangedHandlerRef.current = handler;
  };

  const registerShareTokenRotatedHandler = (handler) => {
    shareTokenRotatedHandlerRef.current = handler;
  };

  // Deduplicate users for display (keep original users array for internal tracking)
  const deduplicatedUsers = deduplicateUsersByUserId(users);

  const value = {
    socket: socketRef.current,
    isConnected,
    currentRoom,
    users: deduplicatedUsers, // Expose deduplicated version
    allUsers: users, // Keep original if needed
    myUserInfo, // Current user's role and info from room:joined
    joinRoom,
    emitOperation, // Unified operation emitter
    emitCursorMove,
    // Handler registration for stable socket listeners
    registerOperationHandler,
    registerRoomJoinedHandler,
    registerRoomErrorHandler,
    registerPermissionChangedHandler,
    registerAccessRevokedHandler,
    registerCollaboratorsChangedHandler,
    registerShareTokenRotatedHandler,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
