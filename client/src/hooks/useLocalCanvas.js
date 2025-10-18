import { useCallback } from 'react';
import { logger } from '../utils/logger';
import { useParams } from 'react-router-dom';

/**
 * Hook for managing local canvas persistence via localStorage
 * Only active for canvas IDs starting with "local-"
 *
 * NOTE: This hook does NOT access CanvasContext directly.
 * Save operations receive canvas data as parameters.
 */
export function useLocalCanvas() {
  const { id: canvasIdFromUrl } = useParams();

  const isLocalCanvas = canvasIdFromUrl?.startsWith('local-');
  const localStorageKey = isLocalCanvas ? `local-canvas-${canvasIdFromUrl}` : null;

  // Load canvas from localStorage
  const loadLocalCanvas = useCallback(() => {
    if (!localStorageKey) return null;

    try {
      const storedData = localStorage.getItem(localStorageKey);
      if (!storedData) return null;

      const canvasData = JSON.parse(storedData);
      logger.log('📂 Loaded local canvas from localStorage:', canvasData);

      return canvasData;
    } catch (error) {
      logger.error('Failed to load local canvas:', error);
      return null;
    }
  }, [localStorageKey]);

  // Save canvas to localStorage
  // Takes canvas data as parameter instead of accessing context
  const saveLocalCanvas = useCallback((canvasData, title = 'Untitled Canvas') => {
    if (!localStorageKey) return false;

    try {
      const dataToSave = {
        id: canvasIdFromUrl,
        title: title,
        strokes: canvasData.strokes,
        viewport: canvasData.viewport,
        lastModified: Date.now(),
        version: '1.0',
      };

      localStorage.setItem(localStorageKey, JSON.stringify(dataToSave));
      logger.log('💾 Saved local canvas to localStorage:', canvasData.strokes?.length || 0, 'strokes');

      return true;
    } catch (error) {
      logger.error('Failed to save local canvas:', error);
      return false;
    }
  }, [localStorageKey, canvasIdFromUrl]);

  // Clear local canvas from localStorage
  const clearLocalCanvas = useCallback(() => {
    if (!localStorageKey) return;

    try {
      localStorage.removeItem(localStorageKey);
      logger.log('🗑️ Cleared local canvas from localStorage');
    } catch (error) {
      logger.error('Failed to clear local canvas:', error);
    }
  }, [localStorageKey]);

  // Get canvas data for uploading to DB
  const getLocalCanvasData = useCallback(() => {
    if (!isLocalCanvas) return null;
    return loadLocalCanvas();
  }, [isLocalCanvas, loadLocalCanvas]);

  return {
    isLocalCanvas,
    loadLocalCanvas,
    saveLocalCanvas,
    clearLocalCanvas,
    getLocalCanvasData,
  };
}
