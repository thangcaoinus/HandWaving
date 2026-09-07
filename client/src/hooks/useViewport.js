import { useState, useRef, useCallback, useEffect } from 'react';

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 5;
const clampZoom = (z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

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
            const newZoom = clampZoom(oldZoom * 1.2);

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
            zoomRef.current = clampZoom(zoomRef.current * 1.2);
        }
        commitViewportState();
    }, [commitViewportState]);

    const zoomOut = useCallback((cursorX, cursorY, canvasWidth, canvasHeight) => {
        if (cursorX !== undefined && cursorY !== undefined && canvasWidth && canvasHeight) {
            const oldZoom = zoomRef.current;
            const newZoom = clampZoom(oldZoom / 1.2);

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
            zoomRef.current = clampZoom(zoomRef.current / 1.2);
        }
        commitViewportState();
    }, [commitViewportState]);

    // Continuous pinch: zoom around a focal point AND pan by the centroid delta, atomically.
    // focalX/Y + dCentroidX/Y are canvas-element-relative screen coords/deltas (the pinch midpoint
    // and how far it moved this frame). curDist/prevDist are the finger spans this/last frame.
    // We write panRef directly here (not updatePan) so the anchored-zoom correction and the pan
    // delta don't fight updatePan's ±2000 clamp — matching how zoomIn/zoomOut already mutate pan.
    const pinchZoom = useCallback((focalX, focalY, dCentroidX, dCentroidY, curDist, prevDist, canvasWidth, canvasHeight) => {
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;

        const oldZoom = zoomRef.current;
        const ratio = prevDist > 0 ? curDist / prevDist : 1;
        const newZoom = clampZoom(oldZoom * ratio);

        // Focal point → canvas coords under OLD zoom (using the pan BEFORE the centroid moved).
        const canvasX = (focalX - centerX - panRef.current.x) / oldZoom;
        const canvasY = (focalY - centerY - panRef.current.y) / oldZoom;

        zoomRef.current = newZoom;

        // Same canvas point → screen under NEW zoom; the residual keeps the focal point pinned.
        const newScreenX = canvasX * newZoom + centerX + panRef.current.x;
        const newScreenY = canvasY * newZoom + centerY + panRef.current.y;

        // Anchored-zoom correction + two-finger pan delta, applied in one shot.
        panRef.current.x += (focalX - newScreenX) + dCentroidX;
        panRef.current.y += (focalY - newScreenY) + dCentroidY;

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
        pinchZoom,
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