/**
 * Pan mode handler - right-click drag to pan canvas
 * Simplest mode, serves as template for other modes
 */
export function usePanMode(canvasRef, viewport, redrawCanvas) {
  const handleMouseDown = (e) => {
    // Check for right mouse button
    if (e.button === 2) {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return { handled: false };

      const rect = canvas.getBoundingClientRect();
      viewport.startPan(e.clientX - rect.left, e.clientY - rect.top);
      return { handled: true, mode: 'pan' };
    }
    return { handled: false };
  };

  const handleMouseMove = (e) => {
    if (!viewport.isPanning) {
      return { handled: false };
    }

    const canvas = canvasRef.current;
    if (!canvas) return { handled: false };

    const rect = canvas.getBoundingClientRect();
    viewport.updatePan(e.clientX - rect.left, e.clientY - rect.top);
    redrawCanvas();
    return { handled: true };
  };

  const handleMouseUp = () => {
    if (!viewport.isPanning) {
      return { handled: false };
    }

    viewport.endPan();
    return { handled: true };
  };

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
