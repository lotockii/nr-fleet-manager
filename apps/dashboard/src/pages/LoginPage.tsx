import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import type { LoginResponse } from '@/types/api';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
      login(data.token, data.user);
      // Force password change if required (e.g. first login with default password)
      if (data.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate('/instances', { replace: true });
      }
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 p-8 shadow-lg dark:border dark:border-gray-700">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Radio className="h-10 w-10 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">NR Fleet Manager</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-500"
              placeholder="admin@admin.com"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-500"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
        </form>


      </div>
    </div>
  );
}
