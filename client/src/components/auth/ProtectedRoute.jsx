import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedRoute({ children, requireNonGuest = false }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="paper-surface min-h-screen flex items-center justify-center text-[color:var(--ink)]">
        <div className="font-display text-2xl">
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
