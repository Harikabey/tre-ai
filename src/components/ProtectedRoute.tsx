// FILE: src/components/ProtectedRoute.tsx
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

type ProtectedRouteProps = {
  children: ReactNode;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground" aria-live="polite">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
        <p>Yükleniyor...</p>
      </main>
    );
  }

  return session
    ? <>{children}</>
    : <Navigate
      to="/auth"
      replace
      state={{ from: `${location.pathname}${location.search}${location.hash}` }}
    />;
};

export default ProtectedRoute;