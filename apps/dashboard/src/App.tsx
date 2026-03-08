import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { ChangePasswordPage } from '@/pages/ChangePasswordPage';
import { InstancesPage } from '@/pages/InstancesPage';
import { InstanceDetailPage } from '@/pages/InstanceDetailPage';
import { AuditPage } from '@/pages/AuditPage';
import { WorkspaceUsersPage } from '@/pages/WorkspaceUsersPage';
import { WorkspacesPage } from '@/pages/WorkspacesPage';
import { WorkspaceAccessPage } from '@/pages/WorkspaceAccessPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { UniversalTokensPage } from '@/pages/UniversalTokensPage';
import { useAuthStore } from '@/store/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (user?.role !== 'super_admin') {
    return <Navigate to="/instances" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />

          {/* Protected */}
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/instances" replace />} />
            <Route path="/instances" element={<InstancesPage />} />
            <Route path="/instances/:id" element={<InstanceDetailPage />} />
            <Route path="/workspaces" element={<WorkspacesPage />} />
            <Route path="/workspaces/:id/access" element={<WorkspaceAccessPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route
              path="/workspace-users"
              element={
                <SuperAdminRoute>
                  <WorkspaceUsersPage />
                </SuperAdminRoute>
              }
            />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/universal-tokens" element={<UniversalTokensPage />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
