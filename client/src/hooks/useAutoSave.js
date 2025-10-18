import { useEffect, useRef, useCallback } from 'react';

/**
 * Smart auto-save hook
 * - Saves after 2 seconds of inactivity
 * - Saves before page unload if there are unsaved changes
 * - Debounces rapid changes to avoid DB spam
 */
export function useAutoSave({
  hasUnsavedChanges,
  saveFunction,
  canSave = true,
  idleDelayMs = 2000,
}) {
  const saveTimeoutRef = useRef(null);
  const lastSaveAttemptRef = useRef(Date.now());

  const scheduleSave = useCallback(() => {
    if (!canSave || !hasUnsavedChanges) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Schedule new save after idle delay
    saveTimeoutRef.current = setTimeout(() => {
      const now = Date.now();
      // Throttle: don't save more than once per second
      if (now - lastSaveAttemptRef.current >= 1000) {
        lastSaveAttemptRef.current = now;
        saveFunction();
      }
    }, idleDelayMs);
  }, [canSave, hasUnsavedChanges, saveFunction, idleDelayMs]);

  // Trigger save scheduling when changes occur
  useEffect(() => {
    if (hasUnsavedChanges) {
      scheduleSave();
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [hasUnsavedChanges, scheduleSave]);

  // Save before page unload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Check if we're forcing a refresh (e.g., permission change)
      if (window.__bypassUnloadWarning) {
        return; // Don't prevent unload
      }

      if (hasUnsavedChanges && canSave) {
        // Cancel pending timeout and save immediately
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveFunction();
        
        // Show browser confirmation dialog
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, canSave, saveFunction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return { scheduleSave };
}
