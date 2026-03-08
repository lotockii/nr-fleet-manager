import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (form.newPassword !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      navigate('/instances', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.response?.data?.error ?? 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 p-8 shadow-lg dark:border dark:border-gray-700">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
            <ShieldAlert className="h-6 w-6 text-orange-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Change your password</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You must change your password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Current password
            </label>
            <input
              type="password"
              required
              value={form.currentPassword}
              onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400"
              placeholder="Current password"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              New password <span className="text-gray-400 font-normal">(min 8 chars)</span>
            </label>
            <input
              type="password"
              required
              value={form.newPassword}
              onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400"
              placeholder="New password"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confirm new password
            </label>
            <input
              type="password"
              required
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400"
              placeholder="Confirm new password"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            Set new password
          </Button>
        </form>
      </div>
    </div>
  );
}
