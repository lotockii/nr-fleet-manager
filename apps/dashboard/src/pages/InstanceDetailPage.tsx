import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, RefreshCw, Download, RotateCcw, FolderOpen } from 'lucide-react';
import { useInstance, useRestartInstance } from '@/hooks/useInstances';
import { useInstanceUsers, useAddUser, useDeleteUser, useUpdateUser, useRefreshUsers, useResetPassword } from '@/hooks/useInstanceUsers';
import { useInstanceProjects, usePullProject, useRollbackProject, useRefreshProjects, useProjectBranches, usePushProject } from '@/hooks/useInstanceProjects';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { copyToClipboard } from '@/lib/clipboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MetricsPanel } from '@/components/metrics/MetricsPanel';
import { MetricsHistory } from '@/components/metrics/MetricsHistory';
import type { AuditLog, Instance, InstanceStatus } from '@/types/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: InstanceStatus) {
  const map: Record<InstanceStatus, 'success' | 'default' | 'destructive' | 'warning'> = {
    online: 'success', offline: 'default', error: 'destructive', unknown: 'warning',
  };
  return <Badge variant={map[status]}>{status}</Badge>;
}

type TabKey = 'users' | 'projects' | 'audit' | 'metrics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts: string | null): string {
  if (!ts) return 'Never synced';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

// ─── Password Reveal Banner ────────────────────────────────────────────────

function PasswordReveal({ password, onDismiss }: { password: string; onDismiss: () => void }) {
  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded p-3 mt-3">
      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
        ⚠️ Save this password — it won't be shown again!
      </p>
      <code className="block mt-1 bg-white dark:bg-gray-900 px-2 py-1 rounded text-sm font-mono break-all text-gray-800 dark:text-gray-100">
        {password}
      </code>
      <div className="mt-2 flex gap-2">
        <button
          className="text-xs text-yellow-700 dark:text-yellow-400 underline"
          onClick={() => copyToClipboard(password)}
        >
          Copy
        </button>
        <button className="text-xs text-gray-400 underline" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
}

// ─── Reset Password Dialog ────────────────────────────────────────────────

function ResetPasswordDialog({
  instanceId,
  username,
  onClose,
  onNeedsRestart,
}: {
  instanceId: string;
  username: string;
  onClose: () => void;
  onNeedsRestart?: () => void;
}) {
  const resetPw = useResetPassword(instanceId);
  const [mode, setMode] = useState<'generate' | 'manual'>('generate');
  const [manualPw, setManualPw] = useState('');
  const [revealed, setRevealed] = useState<string | null>(null);

  const handleReset = () => {
    const payload =
      mode === 'generate'
        ? { username, generatePassword: true }
        : { username, password: manualPw };
    resetPw.mutate(payload, {
      onSuccess: (res) => { setRevealed(res.plainPassword); onNeedsRestart?.(); },
    });
  };

  if (revealed) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 mt-2">
        <p className="text-sm font-medium mb-1 dark:text-gray-200">Password reset for <strong>{username}</strong></p>
        <PasswordReveal password={revealed} onDismiss={onClose} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 mt-2 space-y-3">
      <p className="text-sm font-medium dark:text-gray-200">Reset password for <strong>{username}</strong></p>
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-sm cursor-pointer dark:text-gray-300">
          <input type="radio" checked={mode === 'generate'} onChange={() => setMode('generate')} />
          Generate
        </label>
        <label className="flex items-center gap-1.5 text-sm cursor-pointer dark:text-gray-300">
          <input type="radio" checked={mode === 'manual'} onChange={() => setMode('manual')} />
          Manual
        </label>
      </div>
      {mode === 'manual' && (
        <input
          type="text"
          className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:bg-gray-800 dark:text-gray-100"
          placeholder="New password"
          value={manualPw}
          onChange={(e) => setManualPw(e.target.value)}
        />
      )}
      <div className="flex gap-2">
        <Button size="sm" loading={resetPw.isPending} onClick={handleReset}>Reset</Button>
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
      {resetPw.isError && (
        <p className="text-xs text-red-500">{resetPw.error?.message}</p>
      )}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ instanceId }: { instanceId: string }) {
  const { data, isLoading } = useInstanceUsers(instanceId);
  const users = data?.users ?? [];
  const syncedAt = data?.syncedAt ?? null;
  const refreshUsers = useRefreshUsers(instanceId);
  const addUser = useAddUser(instanceId);
  const deleteUser = useDeleteUser(instanceId);
  const updateRole = useUpdateUser(instanceId);

  // Add user form state
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [permissions, setPermissions] = useState<'*' | 'read'>('read');
  const [addMode, setAddMode] = useState<'generate' | 'manual'>('generate');
  const [manualPw, setManualPw] = useState('');
  const [newUserPassword, setNewUserPassword] = useState<string | null>(null);

  // Per-row reset dialog
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [needsRestart, setNeedsRestart] = useState(false);
  const restartInstance = useRestartInstance();

  const handleAdd = () => {
    if (!username.trim()) return;
    if (!/^[a-zA-Z0-9_.\-@]+$/.test(username.trim())) {
      alert('Username can only contain letters, numbers, _, ., -, @');
      return;
    }
    const payload =
      addMode === 'generate'
        ? { username: username.trim(), permissions, generatePassword: true }
        : { username: username.trim(), permissions, password: manualPw };
    addUser.mutate(payload, {
      onSuccess: (res) => {
        setUsername('');
        setManualPw('');
        setShowForm(false);
        if (res.plainPassword) setNewUserPassword(res.plainPassword);
        setNeedsRestart(true);
      },
    });
  };

  if (isLoading) return <div className="py-8 text-center text-gray-400 dark:text-gray-500">Loading…</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            loading={refreshUsers.isPending}
            onClick={() => refreshUsers.mutate()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(syncedAt)}</span>
        </div>
        <Button size="sm" onClick={() => { setShowForm(!showForm); setNewUserPassword(null); }}>
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      {/* New user password reveal */}
      {newUserPassword && (
        <PasswordReveal password={newUserPassword} onDismiss={() => setNewUserPassword(null)} />
      )}

      {/* Restart required banner */}
      {needsRestart && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/30 px-4 py-3 mb-2">
          <span className="text-sm text-orange-800 dark:text-orange-200">
            🔄 Node-RED restart required for changes to take effect
          </span>
          <button
            onClick={() => {
              restartInstance.mutate(instanceId, {
                onSuccess: () => setNeedsRestart(false),
              });
            }}
            disabled={restartInstance.isPending}
            className="shrink-0 rounded bg-orange-500 hover:bg-orange-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {restartInstance.isPending ? 'Restarting…' : 'Restart Now'}
          </button>
        </div>
      )}

      {/* Add user form */}
      {showForm && (
        <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Username</label>
              <input
                className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:bg-gray-800 dark:text-gray-100"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="firstname.lastname"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Role</label>
              <select
                className="rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm focus:outline-none dark:bg-gray-800 dark:text-gray-100"
                value={permissions}
                onChange={(e) => setPermissions(e.target.value as '*' | 'read')}
              >
                <option value="*">admin</option>
                <option value="read">read-only</option>
              </select>
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer dark:text-gray-300">
              <input type="radio" checked={addMode === 'generate'} onChange={() => setAddMode('generate')} />
              Generate password
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer dark:text-gray-300">
              <input type="radio" checked={addMode === 'manual'} onChange={() => setAddMode('manual')} />
              Manual password
            </label>
          </div>
          {addMode === 'manual' && (
            <input
              type="text"
              className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:bg-gray-800 dark:text-gray-100"
              placeholder="Password"
              value={manualPw}
              onChange={(e) => setManualPw(e.target.value)}
            />
          )}
          <div className="flex gap-2">
            <Button size="sm" loading={addUser.isPending} onClick={handleAdd}>Add User</Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
          {addUser.isError && <p className="text-xs text-red-500">{addUser.error?.message}</p>}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Role</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.username}>
              <TableCell className="font-medium dark:text-gray-100">{u.username}</TableCell>
              <TableCell>
                <select
                  value={u.role === 'admin' ? '*' : 'read'}
                  onChange={(e) =>
                    updateRole.mutate({ username: u.username, permissions: e.target.value })
                  }
                  className="rounded border border-gray-200 dark:border-gray-600 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="*">admin</option>
                  <option value="read">read-only</option>
                </select>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResetFor(resetFor === u.username ? null : u.username)}
                    className="text-xs"
                  >
                    Reset PW
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete user "${u.username}"?`)) deleteUser.mutate(u.username);
                    }}
                    loading={deleteUser.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-gray-400 dark:text-gray-500 py-6">
                No users. Click "Add User" to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Per-user reset password inline dialog */}
      {resetFor && (
        <ResetPasswordDialog
          instanceId={instanceId}
          username={resetFor}
          onClose={() => setResetFor(null)}
          onNeedsRestart={() => setNeedsRestart(true)}
        />
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatRemoteUrl(url: string): string {
  try {
    const sshMatch = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
    if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`;
    const u = new URL(url);
    return (u.hostname + u.pathname).replace(/\.git$/, '');
  } catch {
    return url;
  }
}

// ─── Project Card (with inline branch/commit selector) ───────────────────────

type GitPanelMode = 'pull' | 'rollback' | null;

interface ProjectCardProps {
  instanceId: string;
  project: { name: string; hasGit: boolean; branch: string | null; lastCommit: { hash: string; message: string | null; date: string | null } | null; isDirty: boolean; remote: string | null };
  isPulling: boolean;
  isRollingBack: boolean;
  onPull: (projectName: string, branch?: string) => void;
  onRollback: (projectName: string, commitHash: string) => void;
}

function ProjectCard({ instanceId, project: p, isPulling, isRollingBack, onPull, onRollback }: ProjectCardProps) {
  const [panelMode, setPanelMode] = useState<GitPanelMode>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [pullRemoteBranch, setPullRemoteBranch] = useState<string>('');
  const [selectedCommit, setSelectedCommit] = useState<string>('');

  // Push panel state
  const [showPush, setShowPush] = useState(false);
  const [pushLocal, setPushLocal] = useState('');
  const [pushRemote, setPushRemote] = useState('');
  const [pushOutput, setPushOutput] = useState<string | null>(null);
  const pushProject = usePushProject(instanceId);

  const branchesEnabled = panelMode !== null || showPush;
  const branchesQuery = useProjectBranches(instanceId, p.name, branchesEnabled);

  const handleOpenPanel = (mode: GitPanelMode) => {
    setPanelMode((prev) => (prev === mode ? null : mode));
    setSelectedBranch('');
    setSelectedCommit('');
    setShowPush(false);
  };

  const branches = branchesQuery.data?.branches ?? [];
  const commits = branchesQuery.data?.commits ?? [];

  // Auto-select current branch when data loads
  useEffect(() => {
    if (branches.length > 0 && !selectedBranch) {
      const current = branches.find((b) => b.isCurrent && b.isLocal);
      setSelectedBranch(current?.name ?? branches.find(b => b.isLocal)?.name ?? '');
    }
    if (branches.length > 0 && !pullRemoteBranch) {
      const remote = branches.find((b) => b.isRemote);
      setPullRemoteBranch(remote?.name ?? '');
    }
  }, [branches, selectedBranch, pullRemoteBranch]);

  useEffect(() => {
    if (commits.length > 0 && !selectedCommit) {
      setSelectedCommit(commits[0]?.hash ?? '');
    }
  }, [commits, selectedCommit]);

  // Auto-set push defaults from current branch
  useEffect(() => {
    if (branches.length > 0 && !pushLocal) {
      const current = branches.find((b) => b.isCurrent && b.isLocal);
      if (current) {
        setPushLocal(current.name);
        setPushRemote(current.name);
      }
    }
  }, [branches, pushLocal]);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <FolderOpen className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" />
          <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">{p.name}</span>
          {p.branch && (
            <Badge variant="default" className="font-mono text-xs shrink-0">
              {p.branch}
            </Badge>
          )}
          {p.isDirty && (
            <Badge variant="warning" className="text-xs shrink-0">
              ⚠ Uncommitted changes
            </Badge>
          )}
        </div>
        {p.hasGit && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant={panelMode === 'pull' ? 'default' : 'outline'}
              onClick={() => handleOpenPanel('pull')}
              loading={isPulling}
              disabled={!p.remote}
              title={!p.remote ? 'No remote repository configured' : undefined}
            >
              <Download className="h-3.5 w-3.5" />
              Pull
            </Button>
            <button
              disabled={!p.remote}
              title={!p.remote ? 'No remote repository configured' : undefined}
              onClick={() => { if (!p.remote) return; setShowPush(!showPush); setPanelMode(null); setPushOutput(null); }}
              className={`text-xs px-2 py-1 rounded border transition-colors ${showPush ? 'bg-purple-600 text-white border-purple-600' : 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700'}`}
            >
              ↑ Push
            </button>
            <Button
              size="sm"
              variant={panelMode === 'rollback' ? 'default' : 'outline'}
              onClick={() => handleOpenPanel('rollback')}
              loading={isRollingBack}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Rollback
            </Button>
          </div>
        )}
      </div>

      {/* Remote URL */}
      <div className="flex items-center gap-2">
        {p.remote ? (
          <a
            href={p.remote.startsWith('http') ? p.remote : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline truncate max-w-xs"
            title={p.remote}
          >
            🔗 {formatRemoteUrl(p.remote)}
          </a>
        ) : (
          <span className="text-xs text-gray-400 italic">No remote repository</span>
        )}
      </div>

      {/* Last commit info */}
      {p.lastCommit && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span className="text-xs text-gray-400 dark:text-gray-500">Last commit:</span>
          <code className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
            {p.lastCommit.hash.slice(0, 7)}
          </code>
          {p.lastCommit.message && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[300px]">
              {p.lastCommit.message}
            </span>
          )}
        </div>
      )}

      {/* Inline Git Panel */}
      {panelMode !== null && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 p-3 space-y-3">
          {branchesQuery.isLoading && (
            <p className="text-xs text-gray-400 dark:text-gray-500">Loading branches…</p>
          )}
          {branchesQuery.isError && (
            <p className="text-xs text-red-500">Failed to load git data: {(branchesQuery.error as Error).message}</p>
          )}

          {!branchesQuery.isLoading && !branchesQuery.isError && panelMode === 'pull' && (
            <>
              {/* Pull: From remote → Into local */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">From remote</label>
                  <select
                    value={pullRemoteBranch}
                    onChange={(e) => setPullRemoteBranch(e.target.value)}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="">(default)</option>
                    {branches.filter(b => b.isRemote).map(b => {
                      const label = b.name.replace(/^remotes\/[^/]+\//, '') || b.name;
                      return <option key={b.name} value={b.name}>{label}</option>;
                    })}
                  </select>
                </div>
                <span className="pb-1.5 text-gray-400 text-sm font-bold">→</span>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Into local</label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:bg-gray-800 dark:text-gray-100"
                  >
                    {branches.length === 0 && <option value="">No local branches</option>}
                    {branches.filter(b => b.isLocal).map(b => (
                      <option key={b.name} value={b.name}>
                        {b.isCurrent ? `★ ${b.name}` : b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setPanelMode(null)}>Cancel</Button>
                <Button
                  size="sm"
                  loading={isPulling}
                  disabled={!selectedBranch}
                  onClick={() => {
                    // Pass remote branch if selected, otherwise use local branch name
                    const branch = pullRemoteBranch || selectedBranch;
                    onPull(p.name, branch);
                    setPanelMode(null);
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Pull{pullRemoteBranch ? ` ${pullRemoteBranch.replace(/^remotes\/[^/]+\//, '')} → ${selectedBranch}` : ` ${selectedBranch}`}
                </Button>
              </div>
            </>
          )}

          {!branchesQuery.isLoading && !branchesQuery.isError && panelMode === 'rollback' && (
            <>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300 shrink-0">Commit:</label>
                <select
                  value={selectedCommit}
                  onChange={(e) => setSelectedCommit(e.target.value)}
                  className="flex-1 rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:bg-gray-800 dark:text-gray-100"
                >
                  {commits.length === 0 && <option value="">No commits found</option>}
                  {commits.map(c => (
                    <option key={c.hash} value={c.hash}>
                      {c.hash.slice(0, 7)} — {c.message} ({c.date?.slice(0, 10)})
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ This will reset the working tree to the selected commit. Uncommitted changes will be lost.
              </p>
              <div className="flex items-center gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setPanelMode(null)}>Cancel</Button>
                <Button
                  size="sm"
                  variant="destructive"
                  loading={isRollingBack}
                  disabled={!selectedCommit}
                  onClick={() => { onRollback(p.name, selectedCommit); setPanelMode(null); }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Rollback
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      {/* Push Panel */}
      {showPush && p.hasGit && p.remote && (
        <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-700">
          {branchesQuery.isLoading && (
            <p className="text-xs text-gray-400 dark:text-gray-500">Loading branches…</p>
          )}
          {!branchesQuery.isLoading && (
            <div className="flex gap-2 items-center flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Local branch</label>
                <select
                  value={pushLocal}
                  onChange={e => setPushLocal(e.target.value)}
                  className="text-xs rounded border border-gray-200 dark:border-gray-600 px-2 py-1 dark:bg-gray-800 dark:text-gray-100"
                >
                  {branches.filter(b => b.isLocal).length === 0 && <option value="">No local branches</option>}
                  {branches.filter(b => b.isLocal).map(b => (
                    <option key={b.name} value={b.name}>{b.isCurrent ? `* ${b.name}` : b.name}</option>
                  ))}
                </select>
              </div>
              <span className="text-gray-400 mt-4">→</span>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Remote branch</label>
                <input
                  value={pushRemote}
                  onChange={e => setPushRemote(e.target.value)}
                  placeholder="branch name"
                  className="text-xs rounded border border-gray-200 dark:border-gray-600 px-2 py-1 dark:bg-gray-800 dark:text-gray-100 w-32"
                />
              </div>
              <button
                onClick={() => {
                  setPushOutput(null);
                  pushProject.mutate(
                    { projectName: p.name, localBranch: pushLocal, remoteBranch: pushRemote },
                    {
                      onSuccess: (d) => setPushOutput(d.output || 'Push successful'),
                      onError: (e) => setPushOutput('Error: ' + e.message),
                    }
                  );
                }}
                disabled={pushProject.isPending || !pushLocal}
                className="mt-4 text-xs px-3 py-1 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {pushProject.isPending ? 'Pushing…' : 'Push'}
              </button>
            </div>
          )}
          {pushOutput && (
            <pre className="mt-2 text-xs bg-gray-900 text-green-400 p-2 rounded overflow-auto max-h-24">{pushOutput}</pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Projects Tab ─────────────────────────────────────────────────────────────

function ProjectsTab({ instanceId }: { instanceId: string }) {
  const { data, isLoading } = useInstanceProjects(instanceId);
  const projects = data?.projects ?? [];
  const syncedAt = data?.syncedAt ?? null;
  const refreshProjects = useRefreshProjects(instanceId);
  const pull = usePullProject(instanceId);
  const rollbackMutation = useRollbackProject(instanceId);

  if (isLoading) return <div className="py-8 text-center text-gray-400 dark:text-gray-500">Loading…</div>;

  if (projects.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-500">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Button
            size="sm"
            variant="outline"
            loading={refreshProjects.isPending}
            onClick={() => refreshProjects.mutate()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(syncedAt)}</span>
        </div>
        <FolderOpen className="mx-auto h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">No projects configured for this instance</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          loading={refreshProjects.isPending}
          onClick={() => refreshProjects.mutate()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
        <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(syncedAt)}</span>
      </div>
      {projects.map((p) => (
        <ProjectCard
          key={p.name}
          instanceId={instanceId}
          project={p}
          isPulling={pull.isPending && pull.variables?.projectName === p.name}
          isRollingBack={rollbackMutation.isPending && rollbackMutation.variables?.projectName === p.name}
          onPull={(projectName, branch) => pull.mutate({ projectName, branch })}
          onRollback={(projectName, commitHash) => rollbackMutation.mutate({ projectName, commitHash })}
        />
      ))}
    </div>
  );
}

interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

function AuditTab({ instanceId }: { instanceId: string }) {
  const { data: response, isLoading } = useQuery<AuditLogsResponse>({
    queryKey: ['audit', instanceId],
    queryFn: async () => {
      const { data } = await api.get<AuditLogsResponse>(`/audit-logs?instanceId=${instanceId}&limit=50`);
      return data;
    },
  });
  const logs = response?.data ?? [];

  if (isLoading) return <div className="py-8 text-center text-gray-400 dark:text-gray-500">Loading…</div>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Action</TableHead>
          <TableHead>Performed By</TableHead>
          <TableHead>Details</TableHead>
          <TableHead>Timestamp</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
            <TableCell>{log.performedBy}</TableCell>
            <TableCell className="text-xs text-gray-400 dark:text-gray-500">
              {log.details ? JSON.stringify(log.details) : '—'}
            </TableCell>
            <TableCell className="text-xs">{new Date(log.createdAt).toLocaleString()}</TableCell>
          </TableRow>
        ))}
        {logs.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="py-6 text-center text-gray-400 dark:text-gray-500">No audit logs</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: 'users', label: 'Users' },
  { key: 'projects', label: 'Projects' },
  { key: 'metrics', label: '📊 Metrics' },
  { key: 'audit', label: 'Audit' },
];

// ─── Metrics Latest Fetch ─────────────────────────────────────────────────────

interface MetricsLatest {
  instanceId: string;
  uptimeSeconds?: number;
  memoryMB?: number;
  memoryTotalMB?: number;
  cpuPercent?: number;
  cpuLoad1m?: number;
  diskUsedMB?: number;
  diskTotalMB?: number;
  diskFreeMB?: number;
  nodeRedVersion?: string;
  nodeVersion?: string;
  runMode?: string;
}

function useMetricsLatest(instanceId: string) {
  return useQuery<MetricsLatest | null>({
    queryKey: ['metrics-latest', instanceId],
    queryFn: async () => {
      try {
        const { data } = await api.get<MetricsLatest>(`/instances/${instanceId}/metrics/latest`);
        return data;
      } catch {
        return null;
      }
    },
    staleTime: 30_000,
  });
}

export function InstanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>('metrics');
  const { data: inst, isLoading, isError } = useInstance(id!);
  const qc = useQueryClient();

  // Fetch latest metrics on page load; merge into the instance cache if WS hasn't sent data yet
  const { data: metricsLatest } = useMetricsLatest(id!);

  useEffect(() => {
    if (!metricsLatest || !id) return;
    // Only patch if the cached instance has no cpuPercent (WS hasn't updated it yet)
    qc.setQueryData<Instance>(['instances', id], (prev) => {
      if (!prev) return prev;
      if (prev.cpuPercent !== undefined) return prev; // WS already set it, don't overwrite
      // Exclude 'id' and 'instanceId' — those belong to the metrics row, not the instance
      const { id: _metricId, instanceId: _iid, recordedAt: _ts, ...metricFields } = metricsLatest as any;
      return { ...prev, ...metricFields };
    });
  }, [metricsLatest, id, qc]);

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-400 dark:text-gray-500">Loading…</div>;
  }

  if (isError || !inst) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-red-500">
        <p>Instance not found.</p>
        <Link to="/instances" className="text-sm text-gray-500 dark:text-gray-400 underline">Back to instances</Link>
      </div>
    );
  }

  // Build effective instance: merge metrics/latest if cpuPercent not yet in inst (WS hasn't fired)
  const effectiveInst: Instance = (() => {
    if (inst.cpuPercent !== undefined || !metricsLatest) return inst;
    const { id: _mid, instanceId: _iid2, recordedAt: _ts2, ...metricFields } = metricsLatest as any;
    return { ...inst, ...metricFields };
  })();

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/instances"
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft className="h-4 w-4" /> All instances
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{inst.name}</h1>
          {statusBadge(inst.status)}
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {inst.host}:{inst.port} · NR v{inst.nodeRedVersion ?? '?'} · Node {inst.nodeVersion ?? '?'}
          {inst.osName && (
            <span className="ml-1">
              · {inst.osName === 'Darwin' ? 'macOS' : inst.osName} {inst.osVersion ?? ''} {inst.osArch ?? ''}
            </span>
          )}
        </p>
        {((inst as any).localIp || (inst as any).publicIp) && (
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            {(inst as any).localIp && <span>🏠 {(inst as any).localIp}</span>}
            {(inst as any).localIp && (inst as any).publicIp && <span className="mx-1">·</span>}
            {(inst as any).publicIp && <span>🌐 {(inst as any).publicIp}</span>}
          </p>
        )}
        {effectiveInst.cpuPercent !== undefined && (
          <div className="mt-3">
            <MetricsPanel instance={effectiveInst} />
          </div>
        )}

      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        {activeTab === 'users' && <UsersTab instanceId={inst.id} />}
        {activeTab === 'projects' && <ProjectsTab instanceId={inst.id} />}
        {activeTab === 'metrics' && <MetricsHistory instanceId={inst.id} />}
        {activeTab === 'audit' && <AuditTab instanceId={inst.id} />}
      </div>
    </div>
  );
}
