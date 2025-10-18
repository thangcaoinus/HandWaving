import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINTS } from '../config/api';

const API_URL = API_ENDPOINTS.CANVASES;

export function useCanvasAPI() {
  const { token, isAuthenticated } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Save canvas (create or update)
  const saveCanvas = useCallback(async (canvasId, canvasData) => {
    if (!isAuthenticated) {
      throw new Error('You must be logged in to save canvases');
    }

    setSaving(true);
    setError(null);

    try {
      const url = canvasId ? `${API_URL}/${canvasId}` : API_URL;
      const method = canvasId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(canvasData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save canvas');
      }

      const data = await response.json();
      return data.canvas;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [token, isAuthenticated]);

  // Load canvas by ID
  const loadCanvas = useCallback(async (canvasId) => {
    if (!isAuthenticated) {
      throw new Error('You must be logged in to load canvases');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/${canvasId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load canvas');
      }

      const data = await response.json();
      return data.canvas;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated]);

  // Update canvas metadata (title, description)
  const updateMetadata = useCallback(async (canvasId, metadata) => {
    if (!isAuthenticated) {
      throw new Error('You must be logged in to update canvases');
    }

    try {
      const response = await fetch(`${API_URL}/${canvasId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(metadata),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update canvas');
      }

      const data = await response.json();
      return data.canvas;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [token, isAuthenticated]);

  return {
    saveCanvas,
    loadCanvas,
    updateMetadata,
    saving,
    loading,
    error,
  };
}
