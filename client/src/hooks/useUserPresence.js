import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

export function useUserPresence(canvasRef, viewport, redrawCanvas) {
  const { socket, users, emitCursorMove } = useSocket();
  const userCursorsRef = useRef(new Map());
  const throttleRef = useRef(null);
  const [lastCursorUpdate, setLastCursorUpdate] = useState(0);

  // Redraw canvas when cursors update
  useEffect(() => {
    if (lastCursorUpdate > 0) {
      redrawCanvas();
    }
  }, [lastCursorUpdate, redrawCanvas]);

  useEffect(() => {
    if (!socket) return;

    const handleCursorMove = ({ userId, position }) => {
      userCursorsRef.current.set(userId, {
        screen: position.screen || position,
        canvas: position.canvas || position,
        lastUpdate: Date.now()
      });
      setLastCursorUpdate(Date.now());
    };

    socket.on('cursor:move', handleCursorMove);

    return () => {
      socket.off('cursor:move', handleCursorMove);
    };
  }, [socket]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const screenPosition = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      // Convert to canvas coordinates for accurate positioning
      const canvasPosition = viewport.screenToCanvas(
        screenPosition.x, 
        screenPosition.y, 
        canvas.width, 
        canvas.height
      );

      // Cancel previous timeout and emit immediately for real-time updates
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }

      // Use requestAnimationFrame for smooth updates instead of setTimeout
      throttleRef.current = requestAnimationFrame(() => {
        emitCursorMove({
          screen: screenPosition,
          canvas: canvasPosition
        });
      });
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      if (throttleRef.current) {
        cancelAnimationFrame(throttleRef.current);
      }
    };
  }, [canvasRef, emitCursorMove, viewport]);

  const drawUserCursors = (ctx) => {
    const currentTime = Date.now();

    userCursorsRef.current.forEach((cursor, userId) => {
      // Increase timeout to 5 seconds to prevent premature cleanup during rapid operations
      if (currentTime - cursor.lastUpdate > 5000) {
        userCursorsRef.current.delete(userId);
        return;
      }

      // Use canvas coordinates for accurate positioning
      const canvasPos = cursor.canvas || cursor;

      // Find user info from users array
      const user = users.find(u => u.id === userId);
      const displayName = user?.username || `User ${userId.substring(0, 6)}`;

      ctx.save();
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(canvasPos.x, canvasPos.y, 4, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.fillText(displayName, canvasPos.x + 8, canvasPos.y - 8);
      ctx.restore();
    });
  };

  return {
    drawUserCursors,
    userCursors: userCursorsRef.current,
    users
  };
}