// App state context - brush settings (color, width, line styles), grid toggle, brush type modes.
// Brush types: 1=Freehand, 2=Smart Shapes, 3=Shape Insert, 4=Rectangle Select, 5=Lasso, 6=Text.

import React, { createContext, useContext, useState } from "react";

const AppStateContext = createContext();

export function AppStateProvider({ children }) {
  const defaultConfig = {
    color: "#000000",
    width: 2,
    lineDash: "solid",
    lineCap: "round",
    lineJoin: "round",
  };

  const [brushSettings, setBrushSettings] = useState(defaultConfig);
  const [showGrid, setShowGrid] = useState(true);
  const [brushType, setBrushType] = useState(1);
  const [insertShapeType, setInsertShapeType] = useState("rectangle");

  const updateBrushColor = (color) => {
    setBrushSettings((prev) => ({ ...prev, color }));
  };

  const updateBrushWidth = (width) => {
    setBrushSettings((prev) => ({ ...prev, width }));
  };

  const updateLineDash = (lineDash) => {
    setBrushSettings((prev) => ({ ...prev, lineDash }));
  };

  const updateLineCap = (lineCap) => {
    setBrushSettings((prev) => ({ ...prev, lineCap }));
  };

  const updateLineJoin = (lineJoin) => {
    setBrushSettings((prev) => ({ ...prev, lineJoin }));
  };

  const toggleGrid = () => {
    setShowGrid((prev) => !prev);
  };

  const updateBrushType = (type) => {
    setBrushType(type);
  };

  const isSelectMode = brushType === 4 || brushType === 5;
  const isLassoMode = brushType === 5;
  const isInsertShapeMode = brushType === 3;
  const isTextMode = brushType === 6;

  const updateInsertShapeType = (shapeType) => {
    setInsertShapeType(shapeType);
  };

  const value = {
    brushSettings,
    setBrushSettings,
    updateBrushColor,
    updateBrushWidth,
    updateLineDash,
    updateLineCap,
    updateLineJoin,
    showGrid,
    setShowGrid,
    toggleGrid,
    updateBrushType,
    brushType,
    isSelectMode,
    isLassoMode,
    isInsertShapeMode,
    isTextMode,
    insertShapeType,
    updateInsertShapeType,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
}
