import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { Server, Play, Square, RotateCcw, ChevronRight, Plus, Trash2, Pencil, Search, CheckSquare } from 'lucide-react';
import { MetricsPanel } from '@/components/metrics/MetricsPanel';
import {
  useInstances,
  useStartInstance,
  useStopInstance,
  useRestartInstance,
  useAddInstance,
  useDeleteInstance,
  useUpdateInstance,
  useBulkAction,
} from '@/hooks/useInstances';
import { useWSStore } from '@/store/ws';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { Instance, InstanceStatus } from '@/types/api';

// ─── Status Badge ─────────────────────────────────────────────────────────────

function statusBadge(status: InstanceStatus) {
  switch (status) {
    case 'online': return <Badge variant="success">● Online</Badge>;
    case 'offline': return <Badge variant="default">○ Offline</Badge>;
    case 'error': return <Badge variant="destructive">✕ Error</Badge>;
    default: return <Badge variant="warning">? Unknown</Badge>;
  }
}

// ─── Confirm state helpers ────────────────────────────────────────────────────

type ConfirmAction = 'stop' | 'restart' | 'delete';

interface PendingConfirm {
  action: ConfirmAction;
  inst: Instance;
}

type BulkConfirmAction = 'stop' | 'restart';

// ─── Instance Form (shared for Add & Edit) ───────────────────────────────────

interface InstanceFormData {
  name: string;
  host: string;
  port: number;
  tags: string;
}

interface InstanceFormProps {
  initialData?: InstanceFormData;
  onSubmit: (data: InstanceFormData) => void;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
}

function InstanceForm({ initialData, onSubmit, onCancel, loading, submitLabel }: InstanceFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [host, setHost] = useState(initialData?.host ?? '');
  const [port, setPort] = useState(initialData?.port ?? 1880);
  const [tags, setTags] = useState(initialData?.tags ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !host.trim()) return;
    onSubmit({ name: name.trim(), host: host.trim(), port, tags });
  };

  const inputClass =
    'w-full rounded border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:bg-gray-800 dark:text-gray-100';
  const labelClass = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className={labelClass}>Name <span className="text-red-500">*</span></label>
        <input required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="My Node-RED instance" />
      </div>
      <div>
        <label className={labelClass}>Host <span className="text-red-500">*</span></label>
        <input required className={inputClass} value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.100" />
      </div>
      <div>
        <label className={labelClass}>Port</label>
        <input type="number" className={inputClass} value={port} onChange={(e) => setPort(Number(e.target.value))} min={1} max={65535} />
      </div>
      <div>
        <label className={labelClass}>Tags <span className="text-xs text-gray-400">(comma-separated)</span></label>
        <input className={inputClass} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="production, eu-west" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" loading={loading}>{submitLabel}</Button>
      </div>
    </form>
  );
}

// ─── Token Modal ──────────────────────────────────────────────────────────────

function TokenModal({ instanceName, token, wsUrl, onClose }: {
  instanceName: string;
  token: string;
  wsUrl: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>✅ Instance created — save your token!</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
            ⚠️ This token is shown only once. Save it now!
          </p>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agent Token</label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 block rounded bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm font-mono break-all">
                {token}
              </code>
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? '✓ Copied' : 'Copy'}
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Connection instruction</label>
            <pre className="mt-1 rounded bg-gray-100 dark:bg-gray-800 p-3 text-xs overflow-x-auto whitespace-pre-wrap">
{`Fleet URL:    ${wsUrl}
Agent Token:  ${token}
Instance:     ${instanceName}`}
            </pre>
          </div>
          <Button className="w-full" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Instance Dialog ──────────────────────────────────────────────────────

function AddInstanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addInstance = useAddInstance();
  const [createdToken, setCreatedToken] = useState<{ token: string; name: string } | null>(null);

  const handleSubmit = (data: InstanceFormData) => {
    addInstance.mutate(
      { name: data.name, host: data.host, port: data.port, tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [] },
      {
        onSuccess: (result) => {
          const agentToken = (result as any).agentToken as string | undefined;
          if (agentToken) {
            setCreatedToken({ token: agentToken, name: result.name });
          } else {
            onClose();
          }
        },
      },
    );
  };

  if (createdToken) {
    const wsUrl = window.location.origin.replace(/^http/, 'ws') + '/ws';
    return <TokenModal instanceName={createdToken.name} token={createdToken.token} wsUrl={wsUrl} onClose={onClose} />;
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Instance</DialogTitle></DialogHeader>
        <InstanceForm onSubmit={handleSubmit} onCancel={onClose} loading={addInstance.isPending} submitLabel="Add Instance" />
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Instance Dialog ─────────────────────────────────────────────────────

function EditInstanceDialog({ inst, onClose }: { inst: Instance; onClose: () => void }) {
  const updateInstance = useUpdateInstance();
  const handleSubmit = (data: InstanceFormData) => {
    updateInstance.mutate(
      { id: inst.id, name: data.name, host: data.host, port: data.port, tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [] },
      { onSuccess: () => onClose() },
    );
  };
  const initialData: InstanceFormData = { name: inst.name, host: inst.host, port: inst.port, tags: inst.tags.join(', ') };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Instance</DialogTitle></DialogHeader>
        <InstanceForm initialData={initialData} onSubmit={handleSubmit} onCancel={onClose} loading={updateInstance.isPending} submitLabel="Save Changes" />
      </DialogContent>
    </Dialog>
  );
}

// ─── Instance Card ────────────────────────────────────────────────────────────

interface InstanceCardProps {
  inst: Instance;
  onConfirmAction: (confirm: PendingConfirm) => void;
  onEdit: (inst: Instance) => void;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  isSuperAdmin: boolean;
}

function InstanceCard({ inst, onConfirmAction, onEdit, selected, onSelect, isSuperAdmin }: InstanceCardProps) {
  const start = useStartInstance();

  return (
    <Card className="relative">
      {/* Checkbox */}
      <div className="absolute top-3 left-3 z-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(inst.id, e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-gray-900 dark:accent-gray-100"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <CardHeader className="pl-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-gray-400" />
            <CardTitle>{inst.name}</CardTitle>
          </div>
          {statusBadge(inst.status)}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {inst.host}:{inst.port} · NR v{inst.nodeRedVersion ?? '?'} · Node {inst.nodeVersion ?? '?'}
          {(inst as any).osName && ` · ${(inst as any).osName === 'Darwin' ? 'macOS' : (inst as any).osName} ${(inst as any).osArch ?? ''}`}
        </p>
        {((inst as any).localIp || (inst as any).publicIp) && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {(inst as any).localIp && <span>🏠 {(inst as any).localIp}</span>}
            {(inst as any).localIp && (inst as any).publicIp && <span className="mx-1">·</span>}
            {(inst as any).publicIp && <span>🌐 {(inst as any).publicIp}</span>}
          </p>
        )}
        <div className="flex flex-wrap gap-1 pt-1">
          {inst.tags.map((t) => (
            <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button size="sm" variant="success" loading={start.isPending} disabled={inst.status === 'online'} onClick={() => start.mutate(inst.id)}>
              <Play className="h-3 w-3" /> Start
            </Button>
            <Button size="sm" variant="outline" disabled={inst.status === 'offline'} onClick={() => onConfirmAction({ action: 'stop', inst })}>
              <Square className="h-3 w-3" /> Stop
            </Button>
            <Button size="sm" variant="warning" onClick={() => onConfirmAction({ action: 'restart', inst })}>
              <RotateCcw className="h-3 w-3" /> Restart
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="text-gray-500 dark:text-gray-400" onClick={() => onEdit(inst)} title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {isSuperAdmin && (
              <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => onConfirmAction({ action: 'delete', inst })} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Link to={`/instances/${inst.id}`} className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              Details <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        {inst.cpuPercent !== undefined && <MetricsPanel instance={inst} />}
      </CardContent>
    </Card>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS: Array<{ label: string; value: InstanceStatus | 'all' }> = [
  { label: 'All statuses', value: 'all' },
  { label: 'Online', value: 'online' },
  { label: 'Offline', value: 'offline' },
  { label: 'Error', value: 'error' },
  { label: 'Unknown', value: 'unknown' },
];

interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: InstanceStatus | 'all';
  onStatusChange: (v: InstanceStatus | 'all') => void;
  tagFilter: string;
  onTagChange: (v: string) => void;
  allTags: string[];
}

function FilterBar({ search, onSearchChange, statusFilter, onStatusChange, tagFilter, onTagChange, allTags }: FilterBarProps) {
  const selectClass =
    'rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 cursor-pointer';

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name or host…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
      </div>
      <select value={statusFilter} onChange={(e) => onStatusChange(e.target.value as InstanceStatus | 'all')} className={selectClass}>
        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select value={tagFilter} onChange={(e) => onTagChange(e.target.value)} className={selectClass}>
        <option value="all">All tags</option>
        {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );
}

// ─── Bulk Action Toolbar ──────────────────────────────────────────────────────

interface BulkToolbarProps {
  count: number;
  onStart: () => void;
  onRestart: () => void;
  onStop: () => void;
  loading: boolean;
}

function BulkToolbar({ count, onStart, onRestart, onStop, loading }: BulkToolbarProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl px-6 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        <CheckSquare className="h-4 w-4 text-blue-500" />
        {count} instance{count !== 1 ? 's' : ''} selected
      </div>
      <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
      <Button size="sm" variant="success" loading={loading} onClick={onStart}>
        <Play className="h-3 w-3" /> Start
      </Button>
      <Button size="sm" variant="warning" loading={loading} onClick={onRestart}>
        <RotateCcw className="h-3 w-3" /> Restart
      </Button>
      <Button size="sm" variant="destructive" loading={loading} onClick={onStop}>
        <Square className="h-3 w-3" /> Stop
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function InstancesPage() {
  const { data, isLoading, isError } = useInstances();
  const connected = useWSStore((s) => s.connected);
  const authUser = useAuthStore((s) => s.user);
  const isSuperAdmin = authUser?.role === 'super_admin';

  const stopInstance = useStopInstance();
  const restartInstance = useRestartInstance();
  const deleteInstance = useDeleteInstance();
  const bulkAction = useBulkAction();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingInst, setEditingInst] = useState<Instance | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<BulkConfirmAction | null>(null);
  const [bulkResultMsg, setBulkResultMsg] = useState<string | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InstanceStatus | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  const allTags = useMemo(() => {
    if (!data) return [];
    const tagSet = new Set<string>();
    data.forEach((i) => i.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    return data.filter((i) => {
      if (q && !i.name.toLowerCase().includes(q) && !i.host.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (tagFilter !== 'all' && !i.tags.includes(tagFilter)) return false;
      return true;
    });
  }, [data, search, statusFilter, tagFilter]);

  // Selection handlers
  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id));
  const someFilteredSelected = filtered.some((i) => selectedIds.has(i.id));

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        filtered.forEach((i) => next.add(i.id));
      } else {
        filtered.forEach((i) => next.delete(i.id));
      }
      return next;
    });
  };

  // Bulk action execution
  const executeBulkAction = (action: 'start' | 'stop' | 'restart') => {
    const ids = Array.from(selectedIds);
    bulkAction.mutate(
      { ids, action },
      {
        onSuccess: (result) => {
          const succeeded = result.results.filter((r) => r.success).length;
          const failed = result.results.filter((r) => !r.success).length;
          setBulkResultMsg(
            failed === 0
              ? `✓ ${action} applied to ${succeeded} instance${succeeded !== 1 ? 's' : ''}`
              : `⚠ ${succeeded} succeeded, ${failed} failed`,
          );
          setSelectedIds(new Set());
          setBulkConfirm(null);
          setTimeout(() => setBulkResultMsg(null), 4000);
        },
      },
    );
  };

  // Single instance confirm dialog logic
  const confirmTitle = pendingConfirm
    ? pendingConfirm.action === 'stop' ? `Stop "${pendingConfirm.inst.name}"?`
    : pendingConfirm.action === 'restart' ? `Restart "${pendingConfirm.inst.name}"?`
    : `Delete "${pendingConfirm.inst.name}"?`
    : '';

  const confirmDescription = pendingConfirm
    ? pendingConfirm.action === 'stop'
      ? <>Зупинити інстанс <strong>{pendingConfirm.inst.name}</strong>? Node-RED буде недоступний.</>
      : pendingConfirm.action === 'restart'
      ? <>Перезапустити інстанс <strong>{pendingConfirm.inst.name}</strong>?</>
      : <>Видалити інстанс <strong>{pendingConfirm.inst.name}</strong>? Цю дію не можна скасувати.</>
    : '';

  const confirmVariant = pendingConfirm?.action === 'restart' ? 'warning' : 'destructive';
  const confirmLabel = pendingConfirm?.action === 'stop' ? 'Stop' : pendingConfirm?.action === 'restart' ? 'Restart' : 'Delete';
  const isConfirmLoading = stopInstance.isPending || restartInstance.isPending || deleteInstance.isPending;

  const handleConfirm = () => {
    if (!pendingConfirm) return;
    const { action, inst } = pendingConfirm;
    if (action === 'stop') stopInstance.mutate(inst.id, { onSuccess: () => setPendingConfirm(null) });
    else if (action === 'restart') restartInstance.mutate(inst.id, { onSuccess: () => setPendingConfirm(null) });
    else if (action === 'delete') deleteInstance.mutate(inst.id, { onSuccess: () => setPendingConfirm(null) });
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Loading instances…</div>;
  }

  if (isError) {
    return <div className="flex h-64 items-center justify-center text-red-500">Failed to load instances. Check backend connection.</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Instances</h1>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-400'}`} />
            {connected ? 'Live' : 'Disconnected'}
          </span>
          {isSuperAdmin && (
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4" /> Add Instance
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        tagFilter={tagFilter}
        onTagChange={setTagFilter}
        allTags={allTags}
      />

      {/* Count + Select All */}
      <div className="mb-3 flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-500 dark:text-gray-400">
          <input
            type="checkbox"
            checked={allFilteredSelected}
            ref={(el) => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected; }}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-gray-900 dark:accent-gray-100"
          />
          Select all
        </label>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Showing {filtered.length} of {data?.length ?? 0} instances
          {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
        </span>
      </div>

      {/* Bulk result toast */}
      {bulkResultMsg && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 px-4 py-2 text-sm text-green-800 dark:text-green-300">
          {bulkResultMsg}
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500">
          No instances match your filters
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((inst) => (
            <InstanceCard
              key={inst.id}
              inst={inst}
              onConfirmAction={setPendingConfirm}
              onEdit={setEditingInst}
              selected={selectedIds.has(inst.id)}
              onSelect={handleSelectOne}
              isSuperAdmin={isSuperAdmin}
            />
          ))}
        </div>
      )}

      {/* Bulk floating toolbar */}
      {selectedIds.size > 0 && (
        <BulkToolbar
          count={selectedIds.size}
          loading={bulkAction.isPending}
          onStart={() => executeBulkAction('start')}
          onRestart={() => setBulkConfirm('restart')}
          onStop={() => setBulkConfirm('stop')}
        />
      )}

      {/* Add dialog */}
      <AddInstanceDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} />

      {/* Edit dialog */}
      {editingInst && <EditInstanceDialog inst={editingInst} onClose={() => setEditingInst(null)} />}

      {/* Single confirm dialog */}
      <ConfirmDialog
        open={pendingConfirm !== null}
        onClose={() => setPendingConfirm(null)}
        onConfirm={handleConfirm}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        confirmVariant={confirmVariant}
        loading={isConfirmLoading}
      />

      {/* Bulk Stop confirm */}
      <ConfirmDialog
        open={bulkConfirm === 'stop'}
        onClose={() => setBulkConfirm(null)}
        onConfirm={() => executeBulkAction('stop')}
        title={`Stop ${selectedIds.size} instances?`}
        description={<>Зупинити <strong>{selectedIds.size}</strong> інстансів? Node-RED буде недоступний.</>}
        confirmLabel="Stop all"
        confirmVariant="destructive"
        loading={bulkAction.isPending}
      />

      {/* Bulk Restart confirm */}
      <ConfirmDialog
        open={bulkConfirm === 'restart'}
        onClose={() => setBulkConfirm(null)}
        onConfirm={() => executeBulkAction('restart')}
        title={`Restart ${selectedIds.size} instances?`}
        description={<>Перезапустити <strong>{selectedIds.size}</strong> інстансів?</>}
        confirmLabel="Restart all"
        confirmVariant="warning"
        loading={bulkAction.isPending}
      />
    </div>
  );
}
