import { useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { logger } from '../utils/logger';

/**
 * Hook for syncing local canvas changes across browser tabs using BroadcastChannel API
 * Only active for local canvases (IDs starting with "local-")
 */
export function useLocalCanvasSync({ isLocalCanvas, onRemoteOperation, onCanvasSaved }) {
  const { id: canvasIdFromUrl } = useParams();
  const channelRef = useRef(null);

  useEffect(() => {
    if (!isLocalCanvas || !canvasIdFromUrl) return;

    // Create broadcast channel for this specific local canvas
    const channelName = `local-canvas-sync-${canvasIdFromUrl}`;
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    logger.log(`📡 BroadcastChannel opened: ${channelName}`);

    // Listen for messages from other tabs
    channel.onmessage = (event) => {
      const { type, payload } = event.data;

      logger.log(`📨 Received broadcast:`, type, payload);

      switch (type) {
        case 'OPERATION':
          // Apply operation from another tab
          if (onRemoteOperation) {
            onRemoteOperation(payload.operation);
          }
          break;

        case 'CANVAS_SAVED':
          // Another tab saved the canvas to DB
          if (onCanvasSaved) {
            onCanvasSaved(payload.canvasId);
          }
          break;

        case 'VIEWPORT_CHANGE':
          // Optionally sync viewport (disabled by default - can be jarring)
          // if (onViewportChange) {
          //   onViewportChange(payload.viewport);
          // }
          break;

        default:
          logger.warn('Unknown broadcast type:', type);
      }
    };

    return () => {
      logger.log(`📡 BroadcastChannel closed: ${channelName}`);
      channel.close();
    };
  }, [isLocalCanvas, canvasIdFromUrl, onRemoteOperation, onCanvasSaved]);

  // Broadcast operation to other tabs
  const broadcastOperation = useCallback((operation) => {
    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'OPERATION',
        payload: { operation }
      });
      logger.log('📤 Broadcasted operation:', operation.type);
    }
  }, []);

  // Broadcast canvas saved event
  const broadcastCanvasSaved = useCallback((canvasId) => {
    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'CANVAS_SAVED',
        payload: { canvasId }
      });
      logger.log('📤 Broadcasted canvas saved:', canvasId);
    }
  }, []);

  // Broadcast viewport change
  const broadcastViewportChange = useCallback((viewport) => {
    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'VIEWPORT_CHANGE',
        payload: { viewport }
      });
    }
  }, []);

  return {
    broadcastOperation,
    broadcastCanvasSaved,
    broadcastViewportChange,
  };
}
