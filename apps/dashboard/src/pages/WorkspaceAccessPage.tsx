import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Trash2, Plus, UserCheck } from 'lucide-react';
import {
  useWorkspaceAccess,
  useAvailableUsers,
  useGrantAccess,
  useUpdateAccess,
  useRevokeAccess,
} from '@/hooks/useWorkspaceAccess';
import { useWorkspace } from '@/hooks/useWorkspaces';
import { useAuthStore } from '@/store/auth';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { WorkspaceAccess, WorkspaceAccessRole } from '@/types/api';

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<WorkspaceAccessRole, string> = {
  workspace_admin: 'Admin',
  workspace_operator: 'Operator',
  workspace_viewer: 'Viewer',
};

const ROLE_CLASSES: Record<WorkspaceAccessRole, string> = {
  workspace_admin:
    'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  workspace_operator:
    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  workspace_viewer:
    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
};

function RoleBadge({ role }: { role: WorkspaceAccessRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_CLASSES[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

// ─── Grant Access Modal ───────────────────────────────────────────────────────

interface GrantModalProps {
  workspaceId: string;
  onClose: () => void;
}

function GrantAccessModal({ workspaceId, onClose }: GrantModalProps) {
  const { data: availableUsers = [] } = useAvailableUsers(workspaceId);
  const grantAccess = useGrantAccess(workspaceId);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<WorkspaceAccessRole>('workspace_viewer');

  const selectClass =
    'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelClass = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    grantAccess.mutate(
      { userId: selectedUserId, role: selectedRole },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className={labelClass}>Select User <span className="text-red-500">*</span></label>
        {availableUsers.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            All users already have access to this workspace.
          </p>
        ) : (
          <select
            required
            className={selectClass}
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">— choose user —</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        )}
      </div>
      <div>
        <label className={labelClass}>Role</label>
        <select
          className={selectClass}
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as WorkspaceAccessRole)}
        >
          <option value="workspace_admin">workspace_admin</option>
          <option value="workspace_operator">workspace_operator</option>
          <option value="workspace_viewer">workspace_viewer</option>
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          loading={grantAccess.isPending}
          disabled={availableUsers.length === 0}
        >
          Grant Access
        </Button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function WorkspaceAccessPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const workspaceId = id ?? '';
  const { data: workspace } = useWorkspace(workspaceId);
  const { data: accessList = [], isLoading, isError } = useWorkspaceAccess(workspaceId);
  const updateAccess = useUpdateAccess(workspaceId);
  const revokeAccess = useRevokeAccess(workspaceId);

  const [showGrantModal, setShowGrantModal] = useState(false);
  const [revokingEntry, setRevokingEntry] = useState<WorkspaceAccess | null>(null);

  // Determine current user's workspace role
  const isSuperAdmin = user?.role === 'super_admin';
  const myAccessEntry = accessList.find((a) => a.userId === user?.id);
  const isWorkspaceAdmin = isSuperAdmin || myAccessEntry?.role === 'workspace_admin';

  const handleRoleChange = (entry: WorkspaceAccess, newRole: WorkspaceAccessRole) => {
    updateAccess.mutate({ accessId: entry.id, role: newRole });
  };

  const handleRevokeConfirm = () => {
    if (!revokingEntry) return;
    revokeAccess.mutate(revokingEntry.id, { onSuccess: () => setRevokingEntry(null) });
  };

  const selectClass =
    'rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="max-w-4xl">
      {/* Back navigation */}
      <button
        onClick={() => navigate('/workspaces')}
        className="mb-4 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Workspaces
      </button>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {workspace && (
            <span
              className="h-4 w-4 rounded-full shrink-0"
              style={{ backgroundColor: workspace.color }}
            />
          )}
          <Shield className="h-6 w-6 text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {workspace?.name ?? workspaceId} — Access Control
          </h1>
        </div>
        {isWorkspaceAdmin && (
          <Button size="sm" onClick={() => setShowGrantModal(true)}>
            <Plus className="h-4 w-4" />
            Grant Access
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-gray-400">
          Loading access list…
        </div>
      ) : isError ? (
        <div className="flex h-40 items-center justify-center text-red-500">
          Failed to load access list.
        </div>
      ) : accessList.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500">
          <UserCheck className="h-8 w-8 opacity-40" />
          <span>No users have access to this workspace yet</span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">User</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Email</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Role</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Granted</th>
                {isWorkspaceAdmin && (
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300 text-right">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {accessList.map((entry) => {
                const isMe = entry.userId === user?.id;
                return (
                  <tr
                    key={entry.id}
                    className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {entry.userName}
                        {isMe && (
                          <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">(you)</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{entry.userEmail}</td>
                    <td className="px-4 py-3">
                      {isWorkspaceAdmin ? (
                        <select
                          className={selectClass}
                          value={entry.role}
                          onChange={(e) =>
                            handleRoleChange(entry, e.target.value as WorkspaceAccessRole)
                          }
                          disabled={updateAccess.isPending}
                        >
                          <option value="workspace_admin">workspace_admin</option>
                          <option value="workspace_operator">workspace_operator</option>
                          <option value="workspace_viewer">workspace_viewer</option>
                        </select>
                      ) : (
                        <RoleBadge role={entry.role} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(entry.grantedAt).toLocaleDateString()}
                    </td>
                    {isWorkspaceAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            title={isMe ? 'Cannot revoke your own access' : 'Revoke access'}
                            disabled={isMe || revokeAccess.isPending}
                            onClick={() => setRevokingEntry(entry)}
                            className={
                              isMe
                                ? 'opacity-30 cursor-not-allowed'
                                : 'text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300'
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Grant Access Modal */}
      <Dialog open={showGrantModal} onOpenChange={(v) => { if (!v) setShowGrantModal(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Access to {workspace?.name ?? 'Workspace'}</DialogTitle>
          </DialogHeader>
          <GrantAccessModal workspaceId={workspaceId} onClose={() => setShowGrantModal(false)} />
        </DialogContent>
      </Dialog>

      {/* Revoke Confirm */}
      <ConfirmDialog
        open={revokingEntry !== null}
        onClose={() => setRevokingEntry(null)}
        onConfirm={handleRevokeConfirm}
        title={`Revoke access for "${revokingEntry?.userName}"?`}
        description={
          <>
            Remove <strong>{revokingEntry?.userName}</strong>'s access to{' '}
            <strong>{workspace?.name}</strong>? They will no longer be able to access this workspace.
          </>
        }
        confirmLabel="Revoke"
        confirmVariant="destructive"
        loading={revokeAccess.isPending}
      />
    </div>
  );
}
