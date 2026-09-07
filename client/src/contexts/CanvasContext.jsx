// Canvas context - unified stroke storage (Map for O(1) lookups) + selection + undo/redo state.
// Single source of truth for all strokes (local + remote + text). Refs prevent re-renders.

import React, { createContext, useContext, useRef, useCallback, useSyncExternalStore, useMemo } from "react";

const CanvasContext = createContext();

export function CanvasProvider({ children }) {
  const canvasRef = useRef(null);
  const allStrokesRef = useRef(new Map());
  const ongoingStrokeRef = useRef([]);
  const tempCanvasImgRef = useRef(null);
  const selectedStrokeIdsRef = useRef(new Set());
  const selectionRectRef = useRef(null);

  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

  const undoFunctionRef = useRef(null);
  const redoFunctionRef = useRef(null);

  const operationManagerRef = useRef(null);
  const redrawRef = useRef(null);
  const textDraftRef = useRef(null);
  const textCreationRef = useRef(null);
  const listenersRef = useRef(new Set());
  const notificationPending = useRef(false);
  const subscribe = useCallback(listener => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);
  const getSnapshot = useCallback(() => JSON.stringify({
    ids: [...selectedStrokeIdsRef.current],
    texts: [...selectedStrokeIdsRef.current].map(id => allStrokesRef.current.get(id)).filter(s => s?.type === 'text'),
    draft: textDraftRef.current,
  }), []);
  const notifyCanvasChange = useCallback(() => {
    if (notificationPending.current) return;
    notificationPending.current = true;
    queueMicrotask(() => {
      notificationPending.current = false;
      listenersRef.current.forEach(listener => listener());
    });
  }, []);


  const addRemoteStroke = (strokeId, strokeData) => {
    allStrokesRef.current.set(strokeId, strokeData);
  };

  const removeRemoteStroke = (strokeId) => {
    allStrokesRef.current.delete(strokeId);
  };

  const clearLocalStrokes = () => {
    allStrokesRef.current.clear();
    ongoingStrokeRef.current = [];
    tempCanvasImgRef.current = null;
    undoStackRef.current = [];
    redoStackRef.current = [];
    clearSelection();
  };

  const addToSelection = (strokeId) => {
    selectedStrokeIdsRef.current.add(strokeId);
    notifyCanvasChange();
  };

  const removeFromSelection = (strokeId) => {
    selectedStrokeIdsRef.current.delete(strokeId);
    notifyCanvasChange();
  };

  const clearSelection = () => {
    selectedStrokeIdsRef.current.clear();
    notifyCanvasChange();
  };

  const isStrokeSelected = (strokeId) => {
    return selectedStrokeIdsRef.current.has(strokeId);
  };

  const setUndoRedo = (undoFn, redoFn) => {
    undoFunctionRef.current = undoFn;
    redoFunctionRef.current = redoFn;
  };
  
  const setOperationManager = (manager) => {
    operationManagerRef.current = manager;
  };

  const handleUndo = () => {
    if (undoFunctionRef.current) {
      undoFunctionRef.current();
    }
  };

  const handleRedo = () => {
    if (redoFunctionRef.current) {
      redoFunctionRef.current();
    }
  };

  const value = {
    redrawRef, textDraftRef, textCreationRef, notifyCanvasChange, subscribe, getSnapshot,
    canvasRef,
    allStrokesRef,
    ongoingStrokeRef,
    tempCanvasImgRef,
    selectedStrokeIdsRef,
    selectionRectRef,
    undoStackRef,
    redoStackRef,
    operationManagerRef,
    addRemoteStroke,
    removeRemoteStroke,
    clearLocalStrokes,
    addToSelection,
    removeFromSelection,
    clearSelection,
    isStrokeSelected,
    setUndoRedo,
    setOperationManager,
    handleUndo,
    handleRedo,
  };

  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  );
}

export function useCanvasContext() {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error("useCanvasContext must be used within a CanvasProvider");
  }
  return context;
}

export function useCanvasSnapshot() {
  const { subscribe, getSnapshot } = useCanvasContext();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(() => JSON.parse(snapshot), [snapshot]);
}
