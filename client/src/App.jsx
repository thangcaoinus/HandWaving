import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CanvasBoard from './components/canvas/CanvasBoard';
import BrushToolbar from './components/toolbars/BrushToolbar';
import PropertiesSidebar from './components/toolbars/PropertiesSidebar';
import ShapePickerPanel from './components/toolbars/ShapePickerPanel';
import ViewportControls from './components/canvas/ViewportControls';
import UserPresence from './components/collaboration/UserPresence';
import MenuButton from './components/toolbars/MenuButton';
import HelpButton from './components/ui/HelpButton';
import CanvasHeader from './components/canvas/CanvasHeader';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import GalleryPage from './pages/GalleryPage';
import ProfilePage from './pages/ProfilePage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LocalCanvasBanner from './components/banners/LocalCanvasBanner';
import { AppStateProvider } from './contexts/AppStateContext';
import { ViewportProvider } from './contexts/ViewportContext';
import { CanvasProvider } from './contexts/CanvasContext';
import { SocketProvider } from './contexts/SocketContext';
import { CanvasPersistenceProvider } from './contexts/CanvasPersistenceContext';
import { useAuth } from './contexts/AuthContext';
import { useCanvasPersistence } from './contexts/CanvasPersistenceContext';

function CanvasApp() {
  return (
    <SocketProvider>
      <CanvasPersistenceProvider>
        <CanvasAppInner />
      </CanvasPersistenceProvider>
    </SocketProvider>
  );
}

function CanvasAppInner() {
  const { isLocalCanvas } = useCanvasPersistence();
  const { isAuthenticated } = useAuth();

  return (
    <AppStateProvider>
      <ViewportProvider>
        <CanvasProvider>
          <div className='fixed inset-0 overflow-hidden bg-gray-100'>
            {/* Show local canvas banner only for anonymous users on local canvas */}
            {isLocalCanvas && !isAuthenticated && <LocalCanvasBanner />}

            <MenuButton />

            <CanvasHeader />

            <div className="mt-16">
              <BrushToolbar />
            </div>

            <ShapePickerPanel />

            <UserPresence />

            <PropertiesSidebar />

            <CanvasBoard />

            <HelpButton />

            <ViewportControls />
          </div>
        </CanvasProvider>
      </ViewportProvider>
    </AppStateProvider>
  );
}

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f08080] to-[#ffdab9]">
        <div className="text-2xl font-bold" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
          Loading...
        </div>
      </div>
    );
  }

  // Check if there's a pending canvas save that should prevent auto-redirect
  const hasPendingSave = sessionStorage.getItem('pendingCanvasSave');

  return (
    <Routes>
      <Route path="/login" element={
        (isAuthenticated && !hasPendingSave) ? <Navigate to="/gallery" replace /> : <LoginPage />
      } />

      <Route path="/" element={
        isAuthenticated ? <Navigate to="/gallery" replace /> : <LandingPage />
      } />

      <Route path="/gallery" element={
        <ProtectedRoute requireNonGuest>
          <GalleryPage />
        </ProtectedRoute>
      } />

      <Route path="/profile" element={
        <ProtectedRoute requireNonGuest>
          <ProfilePage />
        </ProtectedRoute>
      } />

      <Route path="/canvas/new" element={
        <ProtectedRoute>
          <CanvasApp />
        </ProtectedRoute>
      } />

      <Route path="/canvas/:id" element={<CanvasApp />} />
    </Routes>
  );
}

export default App;