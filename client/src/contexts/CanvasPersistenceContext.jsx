// Canvas persistence context - orchestrates DB save/load, Socket.IO room joining, permissions, auto-save.
// Handles local canvas (localStorage), authenticated canvas (DB), and share link guest access.

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";
import { useCanvasAPI } from "../hooks/useCanvasAPI";
import { useAutoSave } from "../hooks/useAutoSave";
import { useLocalCanvas } from "../hooks/useLocalCanvas";
import ShareLinkJoinModal from '../components/collaboration/ShareLinkJoinModal';
import { getCanvasUrl } from '../config/api';
import { logger } from '../utils/logger';

const CanvasPersistenceContext = createContext(null);

export function CanvasPersistenceProvider({ children }) {
  const { id: canvasIdFromUrl } = useParams();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user, token } = useAuth();
  const navigate = useNavigate();

  const isLocalCanvas = canvasIdFromUrl?.startsWith("local-");

  const inviteToken = searchParams.get("invite");
  const [showGuestJoinModal, setShowGuestJoinModal] = useState(false);
  const [guestAcceptedJoin, setGuestAcceptedJoin] = useState(false);
  const {
    joinRoom,
    currentRoom,
    isConnected,
    myUserInfo,
    registerRoomErrorHandler,
    registerPermissionChangedHandler,
    registerAccessRevokedHandler,
    registerShareTokenRotatedHandler,
  } = useSocket();
  const { saveCanvas, loadCanvas, updateMetadata, saving, loading } =
    useCanvasAPI();

  // Local canvas hooks
  const {
    loadLocalCanvas,
    saveLocalCanvas,
    getLocalCanvasData,
  } = useLocalCanvas();

  const [canvasId, setCanvasId] = useState(canvasIdFromUrl || null);
  const [canvasTitle, setCanvasTitle] = useState("Untitled Canvas");
  const [canvasDescription, setCanvasDescription] = useState("");
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Collaboration state
  const [userRole, setUserRole] = useState(null); // VIEWER, EDITOR, ADMIN, or null if owner
  const [isOwner, setIsOwner] = useState(false);
  const [collaborators, setCollaborators] = useState([]);

  // Link sharing state
  const [shareToken, setShareToken] = useState(null);
  const [linkSharingEnabled, setLinkSharingEnabled] = useState(true);
  const [shareRole, setShareRole] = useState("EDITOR");

  // Refs to store canvas data getters (set by canvas components)
  const getCanvasDataRef = useRef(null);
  const setCanvasDataRef = useRef(null);

  const handleLoad = useCallback(
    async (id) => {
      if (!isAuthenticated) {
        logger.warn("Cannot load canvas - not authenticated");
        return;
      }

      setLoadError(null);

      try {
        const canvas = await loadCanvas(id);

        setCanvasId(canvas.id);
        setCanvasTitle(canvas.title);
        setCanvasDescription(canvas.description || "");
        setLastSaved(new Date(canvas.updatedAt));
        setHasUnsavedChanges(false);

        // Set ownership and role
        const isCanvasOwner = canvas.ownerId === user?.id;
        setIsOwner(isCanvasOwner);

        if (isCanvasOwner) {
          setUserRole(null); // Owner has all permissions
        } else {
          // Find user's collaboration entry
          const userCollab = canvas.collaborations?.find(
            (c) => c.userId === user?.id
          );
          setUserRole(userCollab?.role || "VIEWER");
        }

        // Set link sharing settings (only visible to owner)
        if (isCanvasOwner) {
          setShareToken(canvas.shareToken || null);
          setLinkSharingEnabled(canvas.linkSharingEnabled ?? true);
          setShareRole(canvas.shareRole || "EDITOR");
        }

        if (setCanvasDataRef.current && canvas.data) {
          setCanvasDataRef.current(canvas.data);
        }

        // Fetch collaborators
        fetchCollaborators(id);
      } catch (error) {
        logger.error("Failed to load canvas:", error);
        setLoadError(error.message);

        // Check if it's an authorization error - redirect immediately
        if (error.message && error.message.includes("do not have access")) {
          alert("⛔ Access Denied: You do not have permission to view this canvas.\n\nRedirecting to gallery...");
          window.__bypassUnloadWarning = true;
          navigate("/gallery");
        } else if (error.message && error.message.includes("not found")) {
          alert("🔍 Canvas Not Found: This canvas may have been deleted.\n\nRedirecting to gallery...");
          window.__bypassUnloadWarning = true;
          navigate("/gallery");
        } else {
          // For other errors, also redirect to avoid blank screen
          alert("❌ Failed to load canvas: " + error.message + "\n\nRedirecting to gallery...");
          window.__bypassUnloadWarning = true;
          navigate("/gallery");
        }
      }
    },
    [isAuthenticated, loadCanvas, user, navigate]
  );

  const fetchCollaborators = useCallback(
    async (canvasIdToFetch) => {
      const id = canvasIdToFetch || canvasId;
      if (!id || !isAuthenticated) return;

      try {
        const response = await fetch(
          getCanvasUrl(id, '/collaborators'),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setCollaborators(data.collaborators || []);
        }
      } catch (error) {
        logger.error("Failed to fetch collaborators:", error);
      }
    },
    [canvasId, isAuthenticated, token]
  );

  useEffect(() => {
    // LOCAL CANVAS PATH: Load from localStorage
    if (isLocalCanvas) {
      // Authenticated users should not access local canvases - redirect to gallery
      if (isAuthenticated) {
        logger.log("🚫 Authenticated user attempted to access local canvas, redirecting to gallery");
        navigate('/gallery');
        return;
      }

      logger.log("📂 Loading local canvas from localStorage");
      const localData = loadLocalCanvas();

      if (localData) {
        setCanvasId(localData.id);
        setCanvasTitle(localData.title || "Untitled Canvas");
        setCanvasDescription("");
        setLastSaved(new Date(localData.lastModified));
        setHasUnsavedChanges(false);

        // Local canvas ownership
        setIsOwner(true); // User owns their local canvas
        setUserRole(null);

        // Load strokes into canvas
        if (setCanvasDataRef.current && localData) {
          setCanvasDataRef.current(localData);
        }
      } else {
        logger.log("📂 No existing local canvas data");
        setCanvasId(canvasIdFromUrl);
        setCanvasTitle("Untitled Canvas");
        setIsOwner(true);
        setUserRole(null);
      }

      return; // Skip DB/API logic for local canvas
    }

    // DB CANVAS PATH: Load from API or setup for anonymous
    if (canvasIdFromUrl && !isAuthenticated) {
      // Guest trying to access canvas
      if (inviteToken) {
        // Has invite token → Show guest join modal first
        if (!guestAcceptedJoin) {
          logger.log("Guest accessing share link, showing join modal");
          setShowGuestJoinModal(true);
          return; // Wait for user to accept
        } else {
          // Guest accepted → Setup canvas for anonymous user
          logger.log("📝 Setting up canvas for anonymous user");
          setCanvasId(canvasIdFromUrl);
          setCanvasTitle("Shared Canvas"); // Default title for anon users
          setIsOwner(false);
          setUserRole("VIEWER"); // Will be overridden by Socket.IO room join
          // Don't call handleLoad() - anon users get canvas data from Socket.IO room join
        }
      } else {
        // No invite token → Redirect to login
        logger.log(
          "Guest accessing canvas without invite, redirecting to login"
        );
        navigate(`/login?returnTo=/canvas/${canvasIdFromUrl}`);
        return;
      }
    } else if (canvasIdFromUrl && isAuthenticated) {
      // Authenticated user accessing canvas
      // Build join URL with invite token if present
      const joinUrl = inviteToken
        ? getCanvasUrl(canvasIdFromUrl, `/join?invite=${inviteToken}`)
        : getCanvasUrl(canvasIdFromUrl, '/join');

      // First try to auto-join (backend handles ownership/existing collab checks)
      fetch(joinUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => (res.ok ? res.json() : Promise.reject("Join failed")))
        .then((data) => {
          logger.log("Auto-join result:", data);
        })
        .catch((err) => {
          logger.log("Auto-join failed (might already have access):", err);
        })
        .finally(() => {
          // Always try to load canvas regardless of join result
          handleLoad(canvasIdFromUrl);
        });
    }
  }, [
    canvasIdFromUrl,
    isLocalCanvas,
    isAuthenticated,
    inviteToken,
    token,
    handleLoad,
    navigate,
    loadLocalCanvas,
    setCanvasDataRef,
  ]);

  // Auto-join Socket.IO room when canvas ID is available AND socket is connected
  // Skip for local canvases (no collaboration)
  // For anonymous users: Only join if they've accepted via the modal (guestAcceptedJoin)
  useEffect(() => {
    if (isLocalCanvas) return; // Skip Socket.IO for local canvas

    // Determine if user should join
    const shouldJoin = isAuthenticated || (inviteToken && guestAcceptedJoin);

    if (
      canvasId &&
      shouldJoin &&
      isConnected &&
      currentRoom !== canvasId
    ) {
      logger.log(
        `Auto-joining canvas room: ${canvasId} (socket connected: ${isConnected}, authenticated: ${isAuthenticated}, anonymous: ${!isAuthenticated})`
      );
      joinRoom(currentRoom, canvasId, inviteToken);
    }
  }, [
    canvasId,
    isLocalCanvas,
    isAuthenticated,
    guestAcceptedJoin,
    inviteToken,
    isConnected,
    currentRoom,
    joinRoom,
  ]);

  // Update role for anonymous users from Socket.IO myUserInfo
  useEffect(() => {
    if (!isAuthenticated && myUserInfo?.role) {
      logger.log(`📝 Anonymous user role updated from myUserInfo: ${myUserInfo.role}`);
      setUserRole(myUserInfo.role);
    }
  }, [isAuthenticated, myUserInfo]);

  // Register real-time permission event handlers
  useEffect(() => {

    const handleRoomError = ({ message }) => {
      logger.error("🚫 Room join error:", message);
      alert(`⛔ ${message}\n\nRedirecting...`);

      // Bypass the beforeunload warning
      window.__bypassUnloadWarning = true;

      // Redirect based on auth status
      if (isAuthenticated) {
        // Authenticated users go to gallery
        window.location.href = "/gallery";
      } else {
        // Anonymous users go to home page
        window.location.href = "/";
      }
    };

    const handlePermissionChanged = ({
      canvasId: targetCanvasId,
      newRole,
      message,
    }) => {
      // Only update if it's for current canvas
      if (targetCanvasId === canvasId) {
        logger.log("🔒 Permission changed:", newRole);

        // Show alert and force page refresh to sync everything
        alert(
          `🔒 ${message}\n\nThe page will refresh to update your permissions.`
        );

        // Bypass the beforeunload warning to force refresh
        window.__bypassUnloadWarning = true;

        // Force full page refresh to reload canvas with new permissions
        window.location.reload();
      }
    };

    const handleAccessRevoked = ({ canvasId: targetCanvasId, message }) => {
      // Only act if it's for current canvas
      if (targetCanvasId === canvasId) {
        logger.log("❌ Access revoked from canvas");
        alert(`❌ ${message}\n\nYou will be redirected to the gallery.`);

        // Bypass the beforeunload warning to force redirect
        window.__bypassUnloadWarning = true;

        // Redirect to gallery
        window.location.href = "/gallery";
      }
    };

    const handleShareTokenRotated = ({ canvasId: targetCanvasId, message }) => {
      // Only act if it's for current canvas AND user is anonymous
      if (targetCanvasId === canvasId && !isAuthenticated) {
        logger.log("🔄 Share token rotated, kicking anonymous user");
        alert(`🔄 ${message}\n\nYou will be redirected to the home page.`);

        // Bypass the beforeunload warning to force redirect
        window.__bypassUnloadWarning = true;

        // Redirect anonymous users to home page
        window.location.href = "/";
      }
    };

    if (registerRoomErrorHandler && registerPermissionChangedHandler && registerAccessRevokedHandler && registerShareTokenRotatedHandler) {
      registerRoomErrorHandler(handleRoomError);
      registerPermissionChangedHandler(handlePermissionChanged);
      registerAccessRevokedHandler(handleAccessRevoked);
      registerShareTokenRotatedHandler(handleShareTokenRotated);
    }

    // No cleanup needed - handlers stay registered
  }, [
    canvasId,
    isAuthenticated,
    registerRoomErrorHandler,
    registerPermissionChangedHandler,
    registerAccessRevokedHandler,
    registerShareTokenRotatedHandler,
  ]);

  async function handleSave() {
    if (!getCanvasDataRef.current) {
      logger.error("Canvas data getter not available");
      return;
    }

    // Get current canvas data from the drawing canvas
    const canvasData = getCanvasDataRef.current();

    // LOCAL CANVAS PATH: Save to localStorage
    if (isLocalCanvas) {
      const success = saveLocalCanvas(canvasData, canvasTitle);
      if (success) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        logger.log("💾 Local canvas saved to localStorage");
      } else {
        logger.error("Failed to save local canvas");
      }
      return;
    }

    // DB CANVAS PATH: Save to API
    if (!isAuthenticated) {
      alert("Please login to save your canvas");
      return;
    }

    try {
      logger.log("💾 Saving canvas data:", {
        strokeCount: canvasData.strokes?.length || 0,
        hasData: !!canvasData,
        strokes: canvasData.strokes,
      });

      // Prepare save payload
      const payload = {
        title: canvasTitle,
        description: canvasDescription,
        data: canvasData,
      };

      // Save (create or update)
      const savedCanvas = await saveCanvas(canvasId, payload);

      // If this was a new canvas, set ownership
      const wasNewCanvas = !canvasId;

      setCanvasId(savedCanvas.id);
      setLastSaved(new Date(savedCanvas.updatedAt));
      setHasUnsavedChanges(false);

      // Set ownership for newly created canvas
      if (wasNewCanvas) {
        setIsOwner(true);
        setUserRole(null); // Owner doesn't have a role

        // Update link sharing state with values from saved canvas
        setShareToken(savedCanvas.shareToken || null);
        setLinkSharingEnabled(savedCanvas.linkSharingEnabled ?? true);
        setShareRole(savedCanvas.shareRole || "EDITOR");

        // Update URL
        window.history.replaceState(null, "", `/canvas/${savedCanvas.id}`);

        // Join Socket.IO room
        if (currentRoom !== savedCanvas.id) {
          logger.log(`Auto-joining new canvas room: ${savedCanvas.id}`);
          joinRoom(currentRoom, savedCanvas.id, inviteToken);
        }
      }

      return savedCanvas;
    } catch (error) {
      logger.error("Failed to save canvas:", error);
      alert("Failed to save canvas: " + error.message);
      throw error;
    }
  }

  async function handleUpdateTitle(newTitle) {
    setCanvasTitle(newTitle);
    setHasUnsavedChanges(true);

    // If canvas already saved, update metadata immediately
    if (canvasId && isAuthenticated) {
      try {
        await updateMetadata(canvasId, { title: newTitle });
        setLastSaved(new Date());
      } catch (error) {
        logger.error("Failed to update title:", error);
      }
    }
  }

  const markUnsavedChanges = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  // Smart auto-save: save after 2 seconds of inactivity
  // Local canvas: Always auto-save to localStorage
  // DB canvas: Only if authenticated and has permission
  const canAutoSave = isLocalCanvas
    ? true
    : isAuthenticated &&
      (!canvasId || isOwner || userRole === "EDITOR" || userRole === "ADMIN");

  useAutoSave({
    hasUnsavedChanges,
    saveFunction: handleSave,
    canSave: canAutoSave,
    idleDelayMs: 2000,
  });

  const value = {
    canvasId,
    canvasTitle,
    canvasDescription,
    lastSaved,
    hasUnsavedChanges,
    saving,
    loading,
    loadError,
    isNew: !canvasId,
    isLocalCanvas, // Expose to components

    // Collaboration
    userRole,
    isOwner,
    collaborators,
    // Local canvas: Always editable. DB canvas: Check ownership/role
    canEdit: isLocalCanvas
      ? true
      : !canvasId
      ? true
      : isOwner || userRole === "EDITOR" || userRole === "ADMIN",
    canManageCollaborators: !isLocalCanvas && (isOwner || userRole === "ADMIN"),

    // Link sharing (only visible to owner)
    shareToken,
    linkSharingEnabled,
    shareRole,

    // Functions
    handleSave,
    handleLoad,
    setCanvasTitle: handleUpdateTitle,
    setCanvasDescription,
    markUnsavedChanges,
    fetchCollaborators,
    getLocalCanvasData, // For uploading local canvas

    // Refs for canvas data access
    getCanvasDataRef,
    setCanvasDataRef,
  };

  return (
    <CanvasPersistenceContext.Provider value={value}>
      {/* Show guest join modal if unauthenticated with invite token */}
      {showGuestJoinModal && inviteToken && canvasIdFromUrl && (
        <ShareLinkJoinModal
          canvasId={canvasIdFromUrl}
          inviteToken={inviteToken}
          onClose={() => {
            setShowGuestJoinModal(false);
            setGuestAcceptedJoin(true); // Mark that guest accepted to trigger canvas setup
          }}
        />
      )}
      {children}
    </CanvasPersistenceContext.Provider>
  );
}

export function useCanvasPersistence() {
  const context = useContext(CanvasPersistenceContext);
  if (!context) {
    throw new Error(
      "useCanvasPersistence must be used within CanvasPersistenceProvider"
    );
  }
  return context;
}
