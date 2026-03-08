import { useState } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import {
  useWorkspaceUsers,
  useCreateWorkspaceUser,
  useUpdateWorkspaceUser,
  useDeleteWorkspaceUser,
} from '@/hooks/useWorkspaceUsers';
import type { WorkspaceUser, WorkspaceRole } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// ─── Role Badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: WorkspaceRole }) {
  if (role === 'super_admin') {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-purple-100 text-purple-800">
        super_admin
      </span>
    );
  }
  if (role === 'operator') {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800">
        operator
      </span>
    );
  }
  return (
    <Badge variant="default">viewer</Badge>
  );
}

// ─── User Form Modal ──────────────────────────────────────────────────────────

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  editUser?: WorkspaceUser;
}

function UserFormModal({ open, onClose, editUser }: UserFormModalProps) {
  const isEdit = !!editUser;
  const createMutation = useCreateWorkspaceUser();
  const updateMutation = useUpdateWorkspaceUser();

  const [name, setName] = useState(editUser?.name ?? '');
  const [email, setEmail] = useState(editUser?.email ?? '');
  const [role, setRole] = useState<WorkspaceRole>(editUser?.role ?? 'viewer');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loading = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isEdit && editUser) {
        await updateMutation.mutateAsync({ id: editUser.id, name, role });
      } else {
        await createMutation.mutateAsync({ email, name, role, password });
      }
      onClose();
    } catch {
      setError('Failed to save user. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-100">{isEdit ? 'Edit User' : 'Add User'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-100"
              required
            />
          </div>

          {!isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-100"
                required
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="super_admin">super_admin</option>
              <option value="operator">operator</option>
              <option value="viewer">viewer</option>
            </select>
          </div>

          {!isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-100"
                required
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={loading}>
              {isEdit ? 'Save Changes' : 'Add User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function WorkspaceUsersPage() {
  const { user: currentUser } = useAuthStore();
  const { data: users = [], isLoading, error } = useWorkspaceUsers();
  const deleteMutation = useDeleteWorkspaceUser();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<WorkspaceUser | undefined>(undefined);
  const [deleteUser, setDeleteUser] = useState<WorkspaceUser | undefined>(undefined);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  const handleDelete = async () => {
    if (!deleteUser) return;
    await deleteMutation.mutateAsync(deleteUser.id);
    setDeleteUser(undefined);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400 text-sm">
        Loading users...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-48 text-red-500 text-sm">
        Failed to load users
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Workspace Users</h1>
        {isSuperAdmin && (
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add User
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-950">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
              {isSuperAdmin && (
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
            {users.map((user) => {
              const isSelf = currentUser?.id === user.id;
              return (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{user.email}</td>
                  <td className="px-4 py-3 text-sm">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditUser(user)}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => !isSelf && setDeleteUser(user)}
                          disabled={isSelf}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-gray-400 hover:text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={isSelf ? "Cannot delete yourself" : "Delete"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <UserFormModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      )}
      {editUser && (
        <UserFormModal open={!!editUser} onClose={() => setEditUser(undefined)} editUser={editUser} />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteUser}
        onClose={() => setDeleteUser(undefined)}
        onConfirm={handleDelete}
        title="Delete User"
        description={`Видалити юзера ${deleteUser?.name ?? ''}?`}
        confirmLabel="Delete"
        confirmVariant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
