import { Outlet } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import { NoAccessPage } from '@/pages/Auth/NoAccessPage';

export function ProtectedRoute() {
  const { user, loading, access } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-sb-bg text-sb-text flex items-center justify-center">
        <div className="text-sm text-sb-text-muted">Checking access...</div>
      </div>
    );
  }

  if (!user) {
    const homescreen = import.meta.env.DEV ? '/auth/login' : 'https://the-boundary.app';
    window.location.replace(homescreen);
    return (
      <div className="min-h-screen bg-sb-bg text-sb-text flex items-center justify-center">
        <div className="text-sm text-sb-text-muted">Redirecting to login...</div>
      </div>
    );
  }

  if (!access) return <NoAccessPage />;
  return <Outlet />;
}
