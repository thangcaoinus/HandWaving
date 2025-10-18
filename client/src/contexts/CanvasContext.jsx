// Canvas context - unified stroke storage (Map for O(1) lookups) + selection + undo/redo state.
// Single source of truth for all strokes (local + remote + text). Refs prevent re-renders.

import React, { createContext, useContext, useRef } from "react";

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
  };

  const removeFromSelection = (strokeId) => {
    selectedStrokeIdsRef.current.delete(strokeId);
  };

  const clearSelection = () => {
    selectedStrokeIdsRef.current.clear();
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
