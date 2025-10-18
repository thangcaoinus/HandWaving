import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanvasPersistence } from '../../contexts/CanvasPersistenceContext';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle2, Loader2, LogIn, Clock, UserCircle } from 'lucide-react';

export default function CanvasHeader() {
  const {
    canvasTitle,
    setCanvasTitle,
    lastSaved,
    saving,
    hasUnsavedChanges,
    isLocalCanvas,
    isOwner,
  } = useCanvasPersistence();

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(canvasTitle);
  const [timeSinceLastSave, setTimeSinceLastSave] = useState('');

  // Update "time since last save" every 10 seconds
  useEffect(() => {
    function updateTimeSince() {
      setTimeSinceLastSave(formatLastSaved());
    }

    updateTimeSince();
    const interval = setInterval(updateTimeSince, 10000);
    return () => clearInterval(interval);
  }, [lastSaved]);

  function handleTitleClick() {
    // Only owner or local canvas users can edit title
    if (!isAuthenticated || (!isLocalCanvas && !isOwner)) return;
    setIsEditing(true);
    setEditValue(canvasTitle);
  }

  function handleTitleSubmit() {
    setIsEditing(false);
    if (editValue.trim() && editValue !== canvasTitle) {
      setCanvasTitle(editValue.trim());
    } else {
      setEditValue(canvasTitle);
    }
  }

  function handleTitleKeyDown(e) {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(canvasTitle);
    }
  }

  function formatLastSaved() {
    if (!lastSaved) return '';

    const now = new Date();
    const diff = now - lastSaved;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return lastSaved.toLocaleDateString();
  }

  return (
    <>
      {/* Title + Status Bar - Top Left (next to MenuButton) */}
      <div className="fixed top-4 left-16 z-10 flex items-center gap-2 h-10">
        {/* Title - Fixed width with centered text */}
        <div className="w-64">
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleTitleKeyDown}
              className="w-full px-3 py-2 bg-white sketch-panel border-2 border-[#f08080] text-sm font-bold text-center"
              style={{ fontFamily: 'Comic Sans MS, cursive' }}
              autoFocus
              maxLength={100}
            />
          ) : (
            <div
              onClick={handleTitleClick}
              className={`px-3 py-2 bg-white sketch-panel text-sm font-bold truncate text-center ${
                (isLocalCanvas || isOwner) && isAuthenticated ? 'cursor-pointer hover:bg-gray-50' : ''
              }`}
              style={{ fontFamily: 'Comic Sans MS, cursive' }}
              title={(isLocalCanvas || isOwner) && isAuthenticated ? 'Click to edit title' : canvasTitle}
            >
              {canvasTitle}
            </div>
          )}
        </div>

        {/* Status - Only show when authenticated */}
        {isAuthenticated && (
          <div className="flex items-center gap-2 bg-white sketch-panel px-3 py-2 text-xs">
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin text-blue-500" />
                <span className="font-medium text-gray-700">Saving...</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                <Clock size={14} className="text-yellow-500" />
                <span className="font-medium text-gray-700">Unsaved</span>
              </>
            ) : lastSaved ? (
              <>
                <CheckCircle2 size={14} className="text-green-500" />
                <span className="text-gray-600">{timeSinceLastSave}</span>
              </>
            ) : (
              <>
                <Clock size={14} className="text-gray-400" />
                <span className="text-gray-500">Not saved</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Anonymous User Info + Login Button - Top Right (only for anonymous users on DB canvas) */}
      {!isAuthenticated && !isLocalCanvas && (
        <div className="fixed top-4 right-[200px] z-10 flex items-center gap-2 h-10">
          {/* Anonymous username indicator */}
          <div className="bg-blue-100/90 border-2 border-blue-300 sketch-panel px-3 py-2 flex items-center gap-2">
            <UserCircle size={14} className="text-blue-600" />
            <span className="text-xs font-medium text-gray-700" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
              {localStorage.getItem('anonymousUsername') || 'Anonymous User'}
            </span>
          </div>

          {/* Login button */}
          <button
            onClick={() => {
              const returnUrl = window.location.pathname + window.location.search;
              navigate(`/login?returnTo=${encodeURIComponent(returnUrl)}`);
            }}
            className="bg-[#f08080] hover:bg-[#e07070] text-white px-3 py-2 sketch-button flex items-center gap-2 text-xs font-bold transition-all hover:scale-105 active:scale-95"
            style={{ fontFamily: 'Comic Sans MS, cursive' }}
          >
            <LogIn size={14} />
            Login
          </button>
        </div>
      )}
    </>
  );
}
