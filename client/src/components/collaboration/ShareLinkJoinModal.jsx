import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileEdit } from 'lucide-react';
import { logger } from '../../utils/logger';

export default function ShareLinkJoinModal({ canvasId, inviteToken, onClose }) {
  const navigate = useNavigate();

  const handleAnonymousJoin = () => {
    // No API call needed - just close modal and let Socket.IO connect with anonymousId
    logger.log('✅ Joining as anonymous user');
    onClose();
  };

  const handleLogin = () => {
    const currentUrl = `/canvas/${canvasId}?invite=${inviteToken}`;
    navigate(`/login?returnTo=${encodeURIComponent(currentUrl)}`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="sketch-panel paper-card p-8 max-w-md w-full font-body text-[color:var(--ink)]">
        <h2 className="font-display text-3xl mb-4 text-center text-[color:var(--ink)]">
          Join Canvas
        </h2>

        <p className="text-[color:var(--ink-soft)] mb-6 text-center">
          You've been invited to collaborate on a canvas!
        </p>

        <div className="space-y-3">
          <button
            onClick={handleAnonymousJoin}
            className="btn-coral focus-sketch w-full !py-3"
          >
            <FileEdit className="w-5 h-5" />
            <span>Continue Anonymously</span>
          </button>

          <div className="text-center text-[color:var(--ink-soft)] text-sm">or</div>

          <button
            onClick={handleLogin}
            className="btn-ghost focus-sketch w-full !py-3"
          >
            🔐 Login / Sign Up
          </button>
        </div>

        <p className="text-xs text-[color:var(--ink-soft)] mt-4 text-center">
          Anonymous: Your work is saved in browser only. Sign up for permanent cloud storage.
        </p>
      </div>
    </div>
  );
}
