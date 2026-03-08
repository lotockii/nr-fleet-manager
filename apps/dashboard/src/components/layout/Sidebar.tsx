import { useState, useRef, useEffect } from 'react';
import logoUrl from '@/assets/logo.png';
import { NavLink, useNavigate } from 'react-router-dom';
import { Server, ClipboardList, LogOut, Users, UserCircle, Layers, ChevronDown, Plus, Check, KeyRound } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useWorkspaceStore } from '@/store/workspace';
import { useWorkspaces, useCreateWorkspace } from '@/hooks/useWorkspaces';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';
import type { Workspace } from '@/types/api';

// ─── Color presets for new workspace ─────────────────────────────────────────

const COLOR_PRESETS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];

// ─── New Workspace Mini Modal ─────────────────────────────────────────────────

function NewWorkspaceModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const createWorkspace = useCreateWorkspace();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createWorkspace.mutate(
      { name: name.trim(), description: description.trim() || undefined, color },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-80 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">New Workspace</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Name *</label>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Color</label>
            <div className="flex gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: color === c ? '#fff' : 'transparent', outline: color === c ? `2px solid ${c}` : 'none' }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createWorkspace.isPending}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
            >
              {createWorkspace.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Workspace Switcher ───────────────────────────────────────────────────────

function WorkspaceSwitcher() {
  const { activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore();
  const { data: workspaces = [] } = useWorkspaces();
  const [open, setOpen] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeWorkspace = workspaces.find((w: Workspace) => w.id === activeWorkspaceId) ?? null;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectWorkspace = (id: string | null) => {
    setActiveWorkspace(id);
    setOpen(false);
  };

  return (
    <>
      <div ref={ref} className="relative px-3 pb-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
            'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
            'text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700',
          )}
        >
          {/* Color dot */}
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: activeWorkspace?.color ?? '#6b7280' }}
          />
          <span className="flex-1 truncate text-left">
            {activeWorkspace?.name ?? 'All Workspaces'}
          </span>
          <ChevronDown className={cn('h-3.5 w-3.5 text-gray-400 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute left-3 right-3 top-full z-40 mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
            {/* All workspaces option */}
            <button
              onClick={() => selectWorkspace(null)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors',
                activeWorkspaceId === null
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
              )}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gray-400" />
              <span className="flex-1">All Workspaces</span>
              {activeWorkspaceId === null && <Check className="h-3.5 w-3.5 text-blue-500" />}
            </button>

            {workspaces.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-800" />
            )}

            {/* Workspace list */}
            {workspaces.map((ws: Workspace) => (
              <button
                key={ws.id}
                onClick={() => selectWorkspace(ws.id)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors',
                  activeWorkspaceId === ws.id
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
                )}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: ws.color }} />
                <span className="flex-1 truncate text-left">{ws.name}</span>
                {activeWorkspaceId === ws.id && <Check className="h-3.5 w-3.5 text-blue-500" />}
              </button>
            ))}

            <div className="border-t border-gray-100 dark:border-gray-800" />

            {/* New workspace button */}
            <button
              onClick={() => { setOpen(false); setShowNewModal(true); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Workspace
            </button>
          </div>
        )}
      </div>

      {showNewModal && <NewWorkspaceModal onClose={() => setShowNewModal(false)} />}
    </>
  );
}

// ─── Nav items ─────────────────────────────────────────────────────────────────

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100',
  );

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === 'super_admin';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <img src={logoUrl} alt="NR Fleet" className="h-8 w-8 rounded" />
        <span className="text-base font-bold text-gray-900 dark:text-gray-100">NR Fleet</span>
      </div>

      {/* Workspace Switcher */}
      <div className="pt-3">
        <WorkspaceSwitcher />
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        <NavLink to="/instances" className={navLinkClass}>
          <Server className="h-4 w-4" />
          Instances
        </NavLink>

        <NavLink to="/workspaces" className={navLinkClass}>
          <Layers className="h-4 w-4" />
          Workspaces
        </NavLink>

        <NavLink to="/universal-tokens" className={navLinkClass}>
          <KeyRound className="h-4 w-4" />
          Universal Tokens
        </NavLink>

        <NavLink to="/audit" className={navLinkClass}>
          <ClipboardList className="h-4 w-4" />
          Audit Log
        </NavLink>

        {/* Super admin only */}
        {isSuperAdmin && (
          <NavLink to="/workspace-users" className={navLinkClass}>
            <Users className="h-4 w-4" />
            Workspace Users
          </NavLink>
        )}
      </nav>

      {/* Bottom: Profile + User + ThemeToggle + Logout */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-3 space-y-1">
        <NavLink to="/profile" className={navLinkClass}>
          <UserCircle className="h-4 w-4" />
          Profile
        </NavLink>

        <div className="pt-1 pb-1 px-3 text-xs font-medium text-gray-400 dark:text-gray-500 truncate">{user?.email}</div>

        <ThemeToggle />

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
