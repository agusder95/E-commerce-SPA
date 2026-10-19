import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { hasRouteAccess } from '../model/access.js';

export default function ProtectedRoute({ children, allowedRoles }) {
  const auth = useAuth();
  const location = useLocation();
  if (!auth.isAuthenticated) return <Navigate to="/auth" replace
    state={{ from: location.pathname + location.search + location.hash }} />;
  if (!hasRouteAccess(auth, allowedRoles)) return <Navigate to="/" replace />;
  return children ?? <Outlet />;
}
