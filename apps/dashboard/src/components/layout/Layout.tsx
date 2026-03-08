import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/store/auth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { api } from '@/lib/api';
import type { AuthUser } from '@/store/auth';

function WSInitializer() {
  useWebSocket();
  return null;
}

function MeInitializer() {
  const { token, setUser } = useAuthStore();

  useEffect(() => {
    if (!token) return;
    api.get<AuthUser>('/auth/me').then(({ data }) => {
      setUser(data);
    }).catch(() => {
      // Token might be expired — interceptor handles logout
    });
  }, [token, setUser]);

  return null;
}

export function Layout() {
  const { token } = useAuthStore();

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <WSInitializer />
      <MeInitializer />
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
