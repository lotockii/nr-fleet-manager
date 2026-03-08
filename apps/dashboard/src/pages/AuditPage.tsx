import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AuditLog, Instance } from '@/types/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const ACTION_OPTIONS = [
  { label: 'All actions', value: '' },
  { label: 'instance.start', value: 'instance.start' },
  { label: 'instance.stop', value: 'instance.stop' },
  { label: 'instance.restart', value: 'instance.restart' },
  { label: 'user.create', value: 'user.create' },
  { label: 'user.update', value: 'user.update' },
  { label: 'user.delete', value: 'user.delete' },
  { label: 'project.pull', value: 'project.pull' },
  { label: 'auth.login', value: 'auth.login' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${day} ${month} ${year} ${hh}:${mm}:${ss}`;
}

function actionBadge(action: string) {
  if (action.includes('start')) return <Badge variant="success">{action}</Badge>;
  if (action.includes('stop')) return <Badge variant="destructive">{action}</Badge>;
  if (action.includes('restart')) return <Badge variant="warning">{action}</Badge>;
  return <Badge variant="default">{action}</Badge>;
}

// ─── Details Cell ─────────────────────────────────────────────────────────────

function DetailsCell({ details }: { details: Record<string, unknown> | undefined }) {
  const [expanded, setExpanded] = useState(false);
  if (!details || Object.keys(details).length === 0) return <span className="text-gray-400 dark:text-gray-600">—</span>;

  const full = JSON.stringify(details, null, 2);
  const short = JSON.stringify(details).slice(0, 60);
  const isTruncated = JSON.stringify(details).length > 60;

  return (
    <button
      onClick={() => setExpanded((v) => !v)}
      className="text-left text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
    >
      {expanded ? (
        <pre className="whitespace-pre-wrap font-mono text-xs max-w-xs">{full}</pre>
      ) : (
        <span>{short}{isTruncated ? '…' : ''}</span>
      )}
    </button>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <TableRow>
      {[...Array(5)].map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" style={{ width: `${60 + i * 10}%` }} />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AuditPage() {
  // Filter state
  const [instanceFilter, setInstanceFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);

  // Applied filters (only change on Search click)
  const [appliedFilters, setAppliedFilters] = useState({
    instanceId: '',
    action: '',
    from: '',
    to: '',
  });

  const offset = page * PAGE_SIZE;

  // Load instances for dropdown
  const { data: instances = [] } = useQuery<Instance[]>({
    queryKey: ['instances'],
    queryFn: async () => {
      const { data } = await api.get<Instance[]>('/instances');
      return data;
    },
  });

  // Build query params
  const queryParams = new URLSearchParams();
  if (appliedFilters.instanceId) queryParams.set('instanceId', appliedFilters.instanceId);
  if (appliedFilters.action) queryParams.set('action', appliedFilters.action);
  if (appliedFilters.from) queryParams.set('from', appliedFilters.from);
  if (appliedFilters.to) {
    // Set to end of day
    queryParams.set('to', appliedFilters.to + 'T23:59:59.999Z');
  }
  queryParams.set('limit', String(PAGE_SIZE));
  queryParams.set('offset', String(offset));

  const { data: response, isLoading } = useQuery<AuditLogsResponse>({
    queryKey: ['audit', appliedFilters, page],
    queryFn: async () => {
      const { data } = await api.get<AuditLogsResponse>(`/audit-logs?${queryParams.toString()}`);
      return data;
    },
  });

  const logs = response?.data ?? [];
  const total = response?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSearch = useCallback(() => {
    setAppliedFilters({
      instanceId: instanceFilter,
      action: actionFilter,
      from: fromDate,
      to: toDate,
    });
    setPage(0);
  }, [instanceFilter, actionFilter, fromDate, toDate]);

  const handleClear = () => {
    setInstanceFilter('');
    setActionFilter('');
    setFromDate('');
    setToDate('');
    setAppliedFilters({ instanceId: '', action: '', from: '', to: '' });
    setPage(0);
  };

  const selectClass =
    'rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 cursor-pointer';
  const inputClass =
    'rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400';

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Log</h1>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Instance */}
        <select value={instanceFilter} onChange={(e) => setInstanceFilter(e.target.value)} className={selectClass}>
          <option value="">All instances</option>
          {instances.map((inst) => (
            <option key={inst.id} value={inst.id}>{inst.name}</option>
          ))}
        </select>

        {/* Action */}
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={selectClass}>
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* From date */}
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className={inputClass}
          placeholder="From date"
        />

        {/* To date */}
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className={inputClass}
          placeholder="To date"
        />

        <Button size="sm" onClick={handleSearch}>
          🔍 Search
        </Button>
        <Button size="sm" variant="outline" onClick={handleClear}>
          Clear filters
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Instance</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Performed By</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-gray-400 dark:text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">📋</span>
                    <span>No audit logs found</span>
                    {(appliedFilters.instanceId || appliedFilters.action || appliedFilters.from || appliedFilters.to) && (
                      <button onClick={handleClear} className="text-sm text-blue-500 hover:underline">
                        Clear filters
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const instName = instances.find((i) => i.id === log.instanceId)?.name;
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
                    <TableCell className="text-xs text-gray-500 dark:text-gray-400">
                      {instName ?? (log.instanceId ? <span className="font-mono">{log.instanceId}</span> : '—')}
                    </TableCell>
                    <TableCell>{actionBadge(log.action)}</TableCell>
                    <TableCell>{log.performedBy}</TableCell>
                    <TableCell>
                      <DetailsCell details={log.details as Record<string, unknown> | undefined} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>{total} total records</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              ← Prev
            </Button>
            <span>Page {page + 1} of {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
