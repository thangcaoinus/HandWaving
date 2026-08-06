import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLocalCanvas } from '../../hooks/useLocalCanvas';
import { useCanvasPersistence } from '../../contexts/CanvasPersistenceContext';
import { API_ENDPOINTS } from '../../config/api';

export default function LocalCanvasBanner() {
  const navigate = useNavigate();
  const { id: canvasId } = useParams();
  const { user } = useAuth();
  const { getLocalCanvasData, clearLocalCanvas } = useLocalCanvas();
  const { handleSave: triggerSave } = useCanvasPersistence();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user) {
      // Not authenticated - manually trigger save to localStorage before redirecting
      await triggerSave();

      // Then redirect to login with intent to save
      sessionStorage.setItem('pendingCanvasSave', 'true');
      sessionStorage.setItem('pendingCanvasId', canvasId);
      navigate(`/login?returnTo=/canvas/${canvasId}`);
      return;
    }

    // Authenticated users (including old guests) - upload to DB
    setIsSaving(true);

    try {
      const localData = getLocalCanvasData();

      if (!localData || !localData.strokes || localData.strokes.length === 0) {
        alert('No content to save');
        setIsSaving(false);
        return;
      }

      const response = await fetch(API_ENDPOINTS.CANVASES, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          title: localData.title || 'Untitled Canvas',
          description: '',
          data: {
            strokes: localData.strokes,
            viewport: localData.viewport,
            version: localData.version,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save canvas');
      }

      const { canvas } = await response.json();

      // Clear localStorage
      clearLocalCanvas();

      // Notify other tabs
      const channel = new BroadcastChannel(`local-canvas-sync-${canvasId}`);
      channel.postMessage({
        type: 'CANVAS_SAVED',
        payload: { canvasId: canvas.id }
      });
      channel.close();

      // Navigate to the saved canvas
      navigate(`/canvas/${canvas.id}`);
    } catch (error) {
      console.error('Failed to save canvas:', error);
      alert(`Failed to save canvas: ${error.message}`);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed top-4 right-[120px] z-50">
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="btn-coral focus-sketch !text-sm !py-2 shadow-md"
      >
        {isSaving ? 'Saving...' : user ? 'Save to Cloud' : 'Login to Save'}
      </button>
    </div>
  );
}
