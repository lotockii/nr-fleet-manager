import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Plus, Pencil, Trash2, Shield } from 'lucide-react';
import { useWorkspaces, useCreateWorkspace, useUpdateWorkspace, useDeleteWorkspace } from '@/hooks/useWorkspaces';
import { useInstances } from '@/hooks/useInstances';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Workspace } from '@/types/api';

// ─── Color presets ────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#ec4899', label: 'Pink' },
];

// ─── Workspace Form ───────────────────────────────────────────────────────────

interface WorkspaceFormData {
  name: string;
  description: string;
  color: string;
}

interface WorkspaceFormProps {
  initialData?: WorkspaceFormData;
  onSubmit: (data: WorkspaceFormData) => void;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
}

function WorkspaceForm({ initialData, onSubmit, onCancel, loading, submitLabel }: WorkspaceFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [color, setColor] = useState(initialData?.color ?? COLOR_PRESETS[0].value);

  const inputClass =
    'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelClass = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim(), color });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className={labelClass}>Name <span className="text-red-500">*</span></label>
        <input
          required
          autoFocus
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Production"
        />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <input
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>
      <div>
        <label className={labelClass}>Color</label>
        <div className="flex gap-3">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => setColor(c.value)}
              className="h-7 w-7 rounded-full transition-transform hover:scale-110 focus:outline-none"
              style={{
                backgroundColor: c.value,
                outline: color === c.value ? `3px solid ${c.value}` : 'none',
                outlineOffset: '2px',
              }}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" loading={loading}>{submitLabel}</Button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function WorkspacesPage() {
  const navigate = useNavigate();
  const { data: workspaces = [], isLoading, isError } = useWorkspaces();
  // Load all instances (no workspace filter) to count per workspace
  const { data: allInstances = [] } = useInstances({ ignoreWorkspaceFilter: true });

  const createWorkspace = useCreateWorkspace();
  const updateWorkspace = useUpdateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingWs, setEditingWs] = useState<Workspace | null>(null);
  const [deletingWs, setDeletingWs] = useState<Workspace | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const instanceCountByWs = (wsId: string) =>
    allInstances.filter((i) => i.workspaceId === wsId).length;

  const handleCreate = (data: WorkspaceFormData) => {
    createWorkspace.mutate(data, { onSuccess: () => setShowAddDialog(false) });
  };

  const handleUpdate = (data: WorkspaceFormData) => {
    if (!editingWs) return;
    updateWorkspace.mutate({ id: editingWs.id, ...data }, { onSuccess: () => setEditingWs(null) });
  };

  const handleDeleteConfirm = () => {
    if (!deletingWs) return;
    const count = instanceCountByWs(deletingWs.id);
    if (count > 0) {
      setDeleteError(`Cannot delete: workspace has ${count} instance(s). Move or delete them first.`);
      return;
    }
    deleteWorkspace.mutate(deletingWs.id, {
      onSuccess: () => setDeletingWs(null),
      onError: (err) => setDeleteError(err.message),
    });
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Loading workspaces…</div>;
  }

  if (isError) {
    return <div className="flex h-64 items-center justify-center text-red-500">Failed to load workspaces.</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="h-6 w-6 text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Workspaces</h1>
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4" /> Add Workspace
        </Button>
      </div>

      {/* Table */}
      {workspaces.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500">
          No workspaces yet. Create one to get started.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Name</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Description</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300 text-center">Instances</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Created</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {workspaces.map((ws) => {
                const count = instanceCountByWs(ws.id);
                return (
                  <tr key={ws.id} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: ws.color }} />
                        <span className="font-medium text-gray-900 dark:text-gray-100">{ws.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {ws.description ?? <span className="italic text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        count > 0
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}>
                        {count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(ws.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/workspaces/${ws.id}/access`)}
                          title="Manage Access"
                        >
                          <Shield className="h-3.5 w-3.5 text-violet-500" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingWs(ws)} title="Edit">
                          <Pencil className="h-3.5 w-3.5 text-gray-500" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setDeletingWs(ws); setDeleteError(null); }}
                          title="Delete"
                          disabled={count > 0}
                          className={count > 0 ? 'opacity-30 cursor-not-allowed' : 'text-red-500 hover:text-red-600'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(v) => { if (!v) setShowAddDialog(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Workspace</DialogTitle></DialogHeader>
          <WorkspaceForm
            onSubmit={handleCreate}
            onCancel={() => setShowAddDialog(false)}
            loading={createWorkspace.isPending}
            submitLabel="Create Workspace"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {editingWs && (
        <Dialog open onOpenChange={(v) => { if (!v) setEditingWs(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Workspace</DialogTitle></DialogHeader>
            <WorkspaceForm
              initialData={{ name: editingWs.name, description: editingWs.description ?? '', color: editingWs.color }}
              onSubmit={handleUpdate}
              onCancel={() => setEditingWs(null)}
              loading={updateWorkspace.isPending}
              submitLabel="Save Changes"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deletingWs !== null}
        onClose={() => { setDeletingWs(null); setDeleteError(null); }}
        onConfirm={handleDeleteConfirm}
        title={`Delete "${deletingWs?.name}"?`}
        description={
          deleteError
            ? <span className="text-red-500">{deleteError}</span>
            : <>Permanently delete workspace <strong>{deletingWs?.name}</strong>? This cannot be undone.</>
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        loading={deleteWorkspace.isPending}
      />
    </div>
  );
}
