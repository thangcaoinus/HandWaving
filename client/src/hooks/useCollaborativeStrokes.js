import { useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useCanvasContext } from '../contexts/CanvasContext';
import { logger } from '../utils/logger';
import { OperationType } from '../utils/operations';

export function useCollaborativeStrokes(redrawCanvas, operationManager = null) {
  const { socket, registerOperationHandler, registerRoomJoinedHandler } = useSocket();
  const { allStrokesRef, clearLocalStrokes } = useCanvasContext();
  const remoteOngoingStrokesRef = useRef(new Map());

  // Keep refs fresh without re-registering handlers
  const operationManagerRef = useRef(operationManager);
  const redrawCanvasRef = useRef(redrawCanvas);

  useEffect(() => {
    operationManagerRef.current = operationManager;
    redrawCanvasRef.current = redrawCanvas;
  }, [operationManager, redrawCanvas]);

  // Register handlers ONCE - socket listeners never re-attach
  useEffect(() => {
    if (!socket || !clearLocalStrokes) return;

    // Handle unified operations from the new operation system
    const handleOperation = ({ operation }) => {
      logger.log('Received operation:', operation.type, operation.id);

      switch (operation.type) {
        case OperationType.STROKE_START:
          remoteOngoingStrokesRef.current.set(operation.payload.strokeId, {
            points: [operation.payload.point],
            config: operation.payload.config,
            userId: operation.userId,
            timestamp: operation.timestamp
          });
          requestAnimationFrame(() => {
            redrawCanvasRef.current();
          });
          break;

        case OperationType.STROKE_PROGRESS: {
          const ongoingStroke = remoteOngoingStrokesRef.current.get(operation.payload.strokeId);
          if (ongoingStroke) {
            ongoingStroke.points.push(operation.payload.point);
            requestAnimationFrame(() => {
              redrawCanvasRef.current();
            });
          }
          break;
        }

        case OperationType.STROKE_ADD:
          // Remove orange preview when stroke is completed
          remoteOngoingStrokesRef.current.delete(operation.payload.strokeId);

          if (operationManagerRef.current) {
            operationManagerRef.current.handleRemoteOperation(operation);
          }
          break;

        case OperationType.STROKE_DELETE:
        case OperationType.STROKE_MOVE:
        case OperationType.STROKE_UNDO:
        case OperationType.STROKE_RESIZE:
        case OperationType.STROKE_ROTATE:
        case OperationType.BATCH_ADD_STROKES:
        case OperationType.BATCH_DELETE_STROKES:
          logger.log(`📥 Forwarding to handleRemoteOperation:`, operation.type);
          if (operationManagerRef.current) {
            operationManagerRef.current.handleRemoteOperation(operation);
          } else {
            logger.error(`❌ No operationManager available!`);
          }
          break;

        default:
          logger.warn('Unknown operation type:', operation.type);
          // Try to handle unknown operations anyway
          if (operationManagerRef.current) {
            operationManagerRef.current.handleRemoteOperation(operation);
          }
      }
    };

    const handleRoomJoined = ({ operations }) => {
      // Only clear local strokes if we have no data loaded
      // This prevents wiping canvas when joining after loading from database
      const hasLocalData = allStrokesRef.current.size > 0;

      if (!hasLocalData) {
        logger.log('📭 No local data, adopting room operations as local strokes');
        clearLocalStrokes();
        remoteOngoingStrokesRef.current.clear();

        // Adopt ALL room operations into unified storage
        if (operations && operations.length > 0 && operationManagerRef.current) {
          logger.log(`Adopting ${operations.length} operations as local strokes`);
          operations.forEach(operation => {
            // Use adoptRoomOperation to add strokes to unified storage
            operationManagerRef.current.adoptRoomOperation(operation);
          });
        }
      } else {
        logger.log(`📦 Keeping local data (${allStrokesRef.current.size} strokes), ignoring room operations on join`);
        // Just clear ongoing strokes to avoid duplicates
        remoteOngoingStrokesRef.current.clear();
      }

      redrawCanvasRef.current();
    };

    // Register handlers with SocketContext - listeners live at top level
    registerOperationHandler(handleOperation);
    registerRoomJoinedHandler(handleRoomJoined);

    // No cleanup needed - handlers stay registered until component unmounts
  }, [socket, clearLocalStrokes, registerOperationHandler, registerRoomJoinedHandler]);

  const drawRemoteOngoingStrokes = (ctx, drawCallback, viewport) => {
    const currentZoom = viewport.getCurrentZoom();
    remoteOngoingStrokesRef.current.forEach((stroke) => {
      const { points, config } = stroke;
      const previewConfig = { ...config, color: 'orange' };
      
      for (let i = 1; i < points.length; i++) {
        drawCallback(points[i - 1], points[i], ctx, previewConfig, currentZoom);
      }
    });
  };

  return {
    remoteOngoingStrokes: remoteOngoingStrokesRef.current,
    drawRemoteOngoingStrokes
  };
}