import { useState, useRef, useCallback, useEffect } from 'react';

export function useViewport(onViewportChange) {
    const zoomRef = useRef(1);
    const panRef = useRef({ x: 0, y: 0 });
    const isPanningRef = useRef(false);
    const lastPanPointRef = useRef(null);

    const [displayState, setDisplayState] = useState({
        zoom: 1,
        pan: { x: 0, y: 0 },
        isPanning: false
    });

    const commitViewportState = useCallback(() => {
        setDisplayState({
            zoom: zoomRef.current,
            pan: { ...panRef.current },
            isPanning: isPanningRef.current
        });
        onViewportChange?.();
    }, [onViewportChange]);

    const zoomIn = useCallback((cursorX, cursorY, canvasWidth, canvasHeight) => {
        if (cursorX !== undefined && cursorY !== undefined && canvasWidth && canvasHeight) {
            const oldZoom = zoomRef.current;
            const newZoom = Math.min(oldZoom * 1.2, 5);
            
            // Convert cursor screen position to canvas coordinates before zoom
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;
            const canvasX = (cursorX - centerX - panRef.current.x) / oldZoom;
            const canvasY = (cursorY - centerY - panRef.current.y) / oldZoom;
            
            // Update zoom
            zoomRef.current = newZoom;
            
            // Convert the same canvas point back to screen coordinates with new zoom
            const newScreenX = canvasX * newZoom + centerX + panRef.current.x;
            const newScreenY = canvasY * newZoom + centerY + panRef.current.y;
            
            // Adjust pan to keep cursor position fixed
            panRef.current.x += cursorX - newScreenX;
            panRef.current.y += cursorY - newScreenY;
        } else {
            zoomRef.current = Math.min(zoomRef.current * 1.2, 5);
        }
        commitViewportState();
    }, [commitViewportState]);

    const zoomOut = useCallback((cursorX, cursorY, canvasWidth, canvasHeight) => {
        if (cursorX !== undefined && cursorY !== undefined && canvasWidth && canvasHeight) {
            const oldZoom = zoomRef.current;
            const newZoom = Math.max(oldZoom / 1.2, 0.4);
            
            // Convert cursor screen position to canvas coordinates before zoom
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;
            const canvasX = (cursorX - centerX - panRef.current.x) / oldZoom;
            const canvasY = (cursorY - centerY - panRef.current.y) / oldZoom;
            
            // Update zoom
            zoomRef.current = newZoom;
            
            // Convert the same canvas point back to screen coordinates with new zoom
            const newScreenX = canvasX * newZoom + centerX + panRef.current.x;
            const newScreenY = canvasY * newZoom + centerY + panRef.current.y;
            
            // Adjust pan to keep cursor position fixed
            panRef.current.x += cursorX - newScreenX;
            panRef.current.y += cursorY - newScreenY;
        } else {
            zoomRef.current = Math.max(zoomRef.current / 1.2, 0.4);
        }
        commitViewportState();
    }, [commitViewportState]);

    const resetViewport = useCallback(() => {
        zoomRef.current = 1;
        panRef.current = { x: 0, y: 0 };
        commitViewportState();
    }, [commitViewportState]);

    const fitToScreen = useCallback(() => {
        zoomRef.current = 0.8;
        panRef.current = { x: 0, y: 0 };
        commitViewportState();
    }, [commitViewportState]);

    const screenToCanvas = useCallback((screenX, screenY, canvasWidth, canvasHeight) => {
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;

        const canvasX = (screenX - centerX - panRef.current.x) / zoomRef.current;
        const canvasY = (screenY - centerY - panRef.current.y) / zoomRef.current;

        return { x: canvasX, y: canvasY };
    }, []);

    const canvasToScreen = useCallback((canvasX, canvasY, canvasWidth, canvasHeight) => {
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;

        const screenX = canvasX * zoomRef.current + centerX + panRef.current.x;
        const screenY = canvasY * zoomRef.current + centerY + panRef.current.y;

        return { x: screenX, y: screenY };
    }, []);

    const applyTransform = useCallback((ctx, canvasWidth, canvasHeight) => {
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;

        ctx.setTransform(
            zoomRef.current, 0, 0, zoomRef.current,
            centerX + panRef.current.x,
            centerY + panRef.current.y
        );
    }, []);

    const startPan = useCallback((screenX, screenY) => {
        isPanningRef.current = true;
        lastPanPointRef.current = { x: screenX, y: screenY };
        commitViewportState();
    }, [commitViewportState]);

    const updatePan = useCallback((screenX, screenY) => {
        if (!isPanningRef.current || !lastPanPointRef.current) return;

        const deltaX = screenX - lastPanPointRef.current.x;
        const deltaY = screenY - lastPanPointRef.current.y;

        // Calculate pan limits (allow panning up to 2000px in any direction)
        const maxPan = 2000;
        const newX = panRef.current.x + deltaX;
        const newY = panRef.current.y + deltaY;

        panRef.current = {
            x: Math.max(-maxPan, Math.min(maxPan, newX)),
            y: Math.max(-maxPan, Math.min(maxPan, newY))
        };

        lastPanPointRef.current = { x: screenX, y: screenY };
    }, []);

    const endPan = useCallback(() => {
        isPanningRef.current = false;
        lastPanPointRef.current = null;
        commitViewportState();
    }, [commitViewportState]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
                e.preventDefault();
                zoomIn();
            } else if (e.ctrlKey && e.key === '-') {
                e.preventDefault();
                zoomOut();
            } else if (e.key === 'F12') {
                e.preventDefault();
            } else if (e.key === 'F11') {
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [zoomIn, zoomOut]);

    const getCurrentZoom = useCallback(() => zoomRef.current, []);

    return {
        zoom: displayState.zoom,
        pan: displayState.pan,
        isPanning: displayState.isPanning,
        getCurrentZoom,
        zoomIn,
        zoomOut,
        resetViewport,
        fitToScreen,
        screenToCanvas,
        canvasToScreen,
        applyTransform,
        startPan,
        updatePan,
        endPan
    };
}