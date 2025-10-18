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

      <div className="min-h-screen bg-gradient-to-br from-[#f08080] to-[#ffdab9] flex items-center justify-center p-4">
        {/* Back to Landing Page Button */}
        <button
          onClick={() => navigate('/')}
          className="fixed top-4 left-4 sketch-button bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 flex items-center gap-2 text-sm font-medium transition-all hover:scale-105 active:scale-95"
          style={{ fontFamily: 'Comic Sans MS, cursive' }}
        >
          <ArrowLeft size={16} />
          Back to Home
        </button>

        <div className="sketch-panel bg-white p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold -rotate-2 text-[#f08080]" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
            HandWaving
          </h1>
          <p className="mt-2 text-gray-600">
            {isLogin ? 'Welcome back!' : 'Create your account'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border-2 border-red-400 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:outline-none focus:border-[#f08080]"
              required
              autoComplete="email"
            />
          </div>

          {/* Username (register only) */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:outline-none focus:border-[#f08080]"
                required
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9_]+"
                title="Username can only contain letters, numbers, and underscores"
                autoComplete="username"
              />
              <p className="text-xs text-gray-500 mt-1">
                3-20 characters, letters, numbers, and underscores only
              </p>
            </div>
          )}

          {/* Display Name (register only) */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="displayName">
                Display Name (optional)
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:outline-none focus:border-[#f08080]"
                maxLength={50}
                autoComplete="name"
              />
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:outline-none focus:border-[#f08080]"
              required
              minLength={8}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
            {!isLogin && (
              <p className="text-xs text-gray-500 mt-1">
                Minimum 8 characters, must include uppercase, lowercase, and number
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="sketch-button w-full bg-[#f08080] hover:bg-[#e07070] text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Please wait...' : isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        {/* Toggle between login/register */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-[#f08080] hover:underline text-sm"
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
