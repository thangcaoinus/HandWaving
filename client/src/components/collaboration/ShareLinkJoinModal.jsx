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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="sketch-panel bg-white p-8 max-w-md w-full">
        <h2
          className="text-3xl font-bold mb-4 text-center"
          style={{ fontFamily: 'Comic Sans MS, cursive' }}
        >
          Join Canvas
        </h2>

        <p className="text-gray-700 mb-6 text-center">
          You've been invited to collaborate on a canvas!
        </p>

        <div className="space-y-3">
          <button
            onClick={handleAnonymousJoin}
            className="sketch-button w-full bg-gradient-to-r from-[#f08080] to-[#ffa07a] text-white font-bold py-3 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2"
            style={{ fontFamily: 'Comic Sans MS, cursive' }}
          >
            <FileEdit className="w-5 h-5" />
            <span>Continue Anonymously</span>
          </button>

          <div className="text-center text-gray-500 text-sm">or</div>

          <button
            onClick={handleLogin}
            className="sketch-button w-full bg-white border-2 border-[#f08080] text-[#f08080] font-bold py-3 hover:bg-[#f08080] hover:text-white transition-colors"
            style={{ fontFamily: 'Comic Sans MS, cursive' }}
          >
            🔐 Login / Sign Up
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          Anonymous: Your work is saved in browser only. Sign up for permanent cloud storage.
        </p>
      </div>
    </div>
  );
}
