// Viewport context - wraps useViewport hook for zoom/pan state sharing across components.

import React, { createContext, useContext, useCallback } from 'react';
import { useViewport as useViewportHook } from '../hooks/useViewport';

const ViewportContext = createContext();

export function ViewportProvider({ children }) {
  const onViewportChange = useCallback(() => {}, []);

  const viewport = useViewportHook(onViewportChange);

  const value = {
    viewport,
  };

  return (
    <ViewportContext.Provider value={value}>
      {children}
    </ViewportContext.Provider>
  );
}

export function useViewportContext() {
  const context = useContext(ViewportContext);
  if (!context) {
    throw new Error('useViewportContext must be used within a ViewportProvider');
  }
  return context;
}