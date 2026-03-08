import { useState } from 'react';
import { User } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

function RoleLabel({ role }: { role: string }) {
  const colors: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-800',
    operator: 'bg-blue-100 text-blue-800',
    viewer: 'bg-gray-100 text-gray-800',
  };
  const cls = colors[role] ?? 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {role}
    </span>
  );
}

export function ProfilePage() {
  const { user } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-lg space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profile</h1>
      </div>

      {/* User Info Card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <User className="h-6 w-6 text-gray-500 dark:text-gray-400" />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{user.name}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Role:</span>
          <RoleLabel role={user.role} />
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-100"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-100"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-100"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <Button type="submit" size="sm" loading={loading}>
            Change Password
          </Button>
        </form>
      </div>
    </div>
  );
}
