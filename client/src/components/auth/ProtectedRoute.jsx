import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedRoute({ children, requireNonGuest = false }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f08080] to-[#ffdab9]">
        <div className="text-2xl font-bold" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Block guests from accessing non-guest routes
  if (requireNonGuest && user?.isGuest) {
    return <Navigate to="/canvas/new" replace />;
  }

  return children;
}
