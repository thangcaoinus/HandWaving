import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from '../components/modals/Modal';
import { ArrowLeft } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const returnTo = searchParams.get('returnTo');

  const [isLogin, setIsLogin] = useState(mode !== 'register');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showUploadPrompt, setShowUploadPrompt] = useState(false);
  const [localCanvasData, setLocalCanvasData] = useState(null);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, username, password, displayName);
      }

      // Check if user was trying to save a local canvas
      const pendingSave = sessionStorage.getItem('pendingCanvasSave');
      const pendingCanvasId = sessionStorage.getItem('pendingCanvasId');

      if (pendingSave && pendingCanvasId) {
        // Load local canvas data
        try {
          const localStorageKey = `local-canvas-${pendingCanvasId}`;
          const storedData = localStorage.getItem(localStorageKey);

          if (storedData) {
            const canvasData = JSON.parse(storedData);

            if (canvasData.strokes && canvasData.strokes.length > 0) {
              // Show upload prompt
              setLocalCanvasData({ canvasData, localStorageKey, pendingCanvasId });
              setShowUploadPrompt(true);
              setLoading(false);
              return; // Don't navigate yet
            }
          }
        } catch (err) {
          console.error('Failed to load pending canvas:', err);
        }

        // Clean up if no valid canvas data
        sessionStorage.removeItem('pendingCanvasSave');
        sessionStorage.removeItem('pendingCanvasId');
      }

      // Normal redirect
      navigate(returnTo || '/gallery');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadCanvas() {
    if (!localCanvasData) return;

    setLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.CANVASES, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          title: localCanvasData.canvasData.title || 'Untitled Canvas',
          description: '',
          data: {
            strokes: localCanvasData.canvasData.strokes,
            viewport: localCanvasData.canvasData.viewport,
            version: localCanvasData.canvasData.version,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to upload canvas');
      }

      const { canvas } = await response.json();

      // Clean up
      localStorage.removeItem(localCanvasData.localStorageKey);
      sessionStorage.removeItem('pendingCanvasSave');
      sessionStorage.removeItem('pendingCanvasId');

      // Navigate to the new canvas
      navigate(`/canvas/${canvas.id}`);
    } catch (err) {
      setError('Failed to upload canvas: ' + err.message);
      setLoading(false);
    }
  }

  function handleSkipUpload() {
    // Clean up localStorage and sessionStorage
    if (localCanvasData) {
      // Delete the local canvas data from localStorage
      localStorage.removeItem(localCanvasData.localStorageKey);

      sessionStorage.removeItem('pendingCanvasSave');
      sessionStorage.removeItem('pendingCanvasId');
    }

    setShowUploadPrompt(false);
    // Always go to gallery after discarding (ignore returnTo for local canvas)
    navigate('/gallery');
  }

  const modalIsOpen = showUploadPrompt && !!localCanvasData;

  return (
    <>
      {/* Upload prompt modal */}
      <ConfirmModal
        isOpen={modalIsOpen}
        onClose={handleSkipUpload}
        title="Upload Local Canvas?"
        message={localCanvasData ? `You have ${localCanvasData.canvasData.strokes.length} strokes in your local canvas. Would you like to save it to your gallery?` : ''}
        onConfirm={handleUploadCanvas}
        onCancel={handleSkipUpload}
        confirmText="Yes, Save It"
        cancelText="No, Discard"
      />

      <div className="paper-surface min-h-screen relative overflow-hidden flex items-center justify-center p-4 font-body text-[color:var(--ink)]">
        {/* Faint roaming doodles — continuity with the landing page */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g stroke="var(--ink)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.1">
            <circle className="doodle-float" style={{ '--r': '-4deg' }} cx="180" cy="160" r="26" />
            <path className="doodle-float" style={{ '--r': '4deg' }} d="M1210 720 l54 -6 l4 58 l-60 8 l-2 -62 z" />
          </g>
          <g stroke="var(--coral)" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.2">
            <path className="doodle-float" style={{ '--r': '2deg' }} d="M1180 200 l64 36 l-110 14 z" />
          </g>
        </svg>

        {/* Back to Landing Page Button */}
        <button
          onClick={() => navigate('/')}
          className="fixed top-4 left-4 z-20 btn-ghost focus-sketch text-sm !py-2 !px-4"
        >
          <ArrowLeft size={16} />
          Back to Home
        </button>

        <div className="sketch-panel paper-card p-8 w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="font-display text-5xl -rotate-2 text-[color:var(--coral)] leading-none">
            HandWaving
          </h1>
          <p className="mt-3 font-display text-xl text-[color:var(--ink)]">
            {isLogin ? 'Welcome back.' : 'Make an account.'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="status-err mb-4">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-bold mb-1 text-[color:var(--ink)]" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="sketch-input"
              required
              autoComplete="email"
            />
          </div>

          {/* Username (register only) */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-bold mb-1 text-[color:var(--ink)]" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="sketch-input"
                required
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9_]+"
                title="Username can only contain letters, numbers, and underscores"
                autoComplete="username"
              />
              <p className="text-xs text-[color:var(--ink-soft)] mt-1">
                3-20 characters, letters, numbers, and underscores only
              </p>
            </div>
          )}

          {/* Display Name (register only) */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-bold mb-1 text-[color:var(--ink)]" htmlFor="displayName">
                Display Name (optional)
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="sketch-input"
                maxLength={50}
                autoComplete="name"
              />
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-sm font-bold mb-1 text-[color:var(--ink)]" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="sketch-input"
              required
              minLength={8}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
            {!isLogin && (
              <p className="text-xs text-[color:var(--ink-soft)] mt-1 leading-snug">
                Minimum 8 characters. Include uppercase, lowercase, and a number.
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-coral focus-sketch w-full text-lg !py-3"
          >
            {loading ? 'Please wait...' : isLogin ? 'Login' : 'Create Account'}
          </button>
        </form>

        {/* Toggle between login/register */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-[color:var(--coral-deep)] hover:underline text-sm font-body"
          >
            {isLogin
              ? "Don't have an account? Register"
              : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
