// Centralized API configuration
// Uses environment variables for production, falls back to localhost for development

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const API_ENDPOINTS = {
  // Auth
  AUTH: `${API_BASE_URL}/api/auth`,

  // Canvases
  CANVASES: `${API_BASE_URL}/api/canvases`,

  // Users
  USERS: `${API_BASE_URL}/api/users`,
};

// Helper to build canvas-specific URLs
export const getCanvasUrl = (canvasId, path = '') => {
  return `${API_ENDPOINTS.CANVASES}/${canvasId}${path}`;
};

// Socket.IO connection URL (no /api prefix)
export const SOCKET_URL = API_BASE_URL;

export default API_BASE_URL;
