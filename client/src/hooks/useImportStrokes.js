import { useCallback } from 'react';
import { OperationType, BatchAddStrokesPayload } from '../utils/operations';
import { generateUniqueIdBatch } from '../utils/idGenerator';
import { logger } from '../utils/logger';

/**
 * Hook for importing strokes through operation manager
 * Handles ID regeneration, size limits, and proper operation flow
 */
export function useImportStrokes(operationManager, allStrokesRef) {
  const importStrokes = useCallback((strokes, options = {}) => {
    const { shouldReplace = false } = options;

    // Validate input
    if (!strokes || !Array.isArray(strokes) || strokes.length === 0) {
      throw new Error('No valid strokes to import');
    }

    // Check storage limits (10MB per canvas)
    const MAX_TOTAL_POINTS = 625000; // ~10MB
    let totalPoints = 0;

    // Count existing points if merging
    if (!shouldReplace && allStrokesRef?.current) {
      for (const stroke of allStrokesRef.current.values()) {
        totalPoints += stroke.points?.length || 0;
      }
    }

    // Count new points
    const newPoints = strokes.reduce((sum, stroke) => sum + (stroke.points?.length || 0), 0);
    totalPoints += newPoints;

    if (totalPoints > MAX_TOTAL_POINTS) {
      const currentMB = (totalPoints * 16 / 1024 / 1024).toFixed(2);
      throw new Error(
        `Import would exceed canvas size limit.\n` +
        `Total: ${currentMB}MB (limit: 10MB)\n` +
        `Try importing fewer strokes or replacing instead of merging.`
      );
    }

    // Generate unique IDs for all strokes in this batch
    // Using batch generator ensures no collisions even for rapid imports
    const newIds = generateUniqueIdBatch(strokes.length, 'imported');

    // Regenerate IDs to avoid conflicts with existing strokes
    const processedStrokes = strokes.map((stroke, index) => {
      // Create clean stroke without userId/username from export
      return {
        id: newIds[index],
        points: stroke.points || [],
        config: stroke.config || {
          color: '#000000',
          width: 2,
          lineDash: [],
          lineCap: 'round',
          lineJoin: 'round',
        },
        shape: stroke.shape || undefined,
        bbox: stroke.bbox || undefined,
        // Explicitly exclude userId/username - these will be added by the operation
      };
    });

    logger.log(`📥 Importing ${processedStrokes.length} strokes (${newPoints} points)`);
    logger.log(`   Mode: ${shouldReplace ? 'REPLACE' : 'MERGE'}`);
    logger.log(`   Total points after import: ${totalPoints}`);

    // If replacing, create delete operation for all existing strokes first
    if (shouldReplace && allStrokesRef?.current?.size > 0) {
      const existingStrokeIds = Array.from(allStrokesRef.current.keys());
      const existingStrokes = Array.from(allStrokesRef.current.values());
      
      logger.log(`🗑️  Clearing ${existingStrokeIds.length} existing strokes`);
      
      // Execute batch delete
      const deleteOperation = {
        type: OperationType.BATCH_DELETE_STROKES,
        payload: {
          strokeIds: existingStrokeIds,
          strokes: existingStrokes, // Store for undo
        },
      };
      
      operationManager.executeOperationWithUser(deleteOperation);
    }

    // Create batch add operation
    const operation = {
      type: OperationType.BATCH_ADD_STROKES,
      payload: BatchAddStrokesPayload.create(processedStrokes),
    };

    // Execute operation (this will broadcast and save)
    operationManager.executeOperationWithUser(operation);

    return {
      success: true,
      imported: processedStrokes.length,
      totalPoints,
    };
  }, [operationManager, allStrokesRef]);

  return { importStrokes };
}
