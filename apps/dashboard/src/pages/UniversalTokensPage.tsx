import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Trash2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { copyToClipboard } from '@/lib/clipboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuthStore } from '@/store/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UniversalToken {
  id: string;
  name: string;
  tokenPlain: string | null;
  workspaceId: string | null;
  createdAt: string;
  isActive: boolean;
}

interface CreatedToken extends UniversalToken {
  token: string;
}

// ─── Token Modal ──────────────────────────────────────────────────────────────

function TokenModal({ tokenName, token, onClose }: { tokenName: string; token: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const wsUrl = window.location.origin.replace(/^http/, 'ws') + '/ws';

  const copy = () => {
    copyToClipboard(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>✅ Universal token created — save it!</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
            ⚠️ This token is shown only once. Save it now!
          </p>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Token name</label>
            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{tokenName}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Universal Token</label>
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
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Connection instructions</label>
            <pre className="mt-1 rounded bg-gray-100 dark:bg-gray-800 p-3 text-xs overflow-x-auto whitespace-pre-wrap">
{`Fleet URL:        ${wsUrl}
Universal Token:  ${token}

Agent register payload:
{
  "type": "register",
  "payload": {
    "instanceName": "<your-instance-name>",
    "host": "localhost",
    "port": 1880,
    "tags": []
  }
}`}
            </pre>
          </div>
          <Button className="w-full" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Token Dialog ──────────────────────────────────────────────────────

function CreateTokenDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (t: CreatedToken) => void }) {
  const [name, setName] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation<CreatedToken, Error, { name: string }>({
    mutationFn: async (payload) => {
      const { data } = await api.post<CreatedToken>('/universal-tokens', payload);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['universal-tokens'] });
      onCreated(data);
    },
  });

  const inputClass =
    'w-full rounded border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:bg-gray-800 dark:text-gray-100';

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Universal Token</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            mutation.mutate({ name: name.trim() });
          }}
          className="flex flex-col gap-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Token name <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production agents"
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" loading={mutation.isPending}>Create Token</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inline token reveal (persists in memory until manually dismissed) ────────

function TokenInlineReveal({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const copy = () => {
    copyToClipboard(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-1.5 rounded bg-gray-100 dark:bg-gray-800 px-2 py-1.5 mb-1">
      <code
        className="flex-1 truncate text-xs font-mono text-gray-700 dark:text-gray-300 cursor-pointer select-all"
        title={visible ? token : 'Click eye to reveal'}
        onClick={() => setVisible(v => !v)}
      >
        {visible ? token : '••••••••••••••••••••••••••••••••'}
      </code>
      <button
        onClick={() => setVisible(v => !v)}
        title={visible ? 'Hide' : 'Show token'}
        className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs px-1"
      >
        {visible ? '🙈' : '👁'}
      </button>
      <button
        onClick={copy}
        title="Copy token"
        className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
      >
        {copied ? '✓' : 'Copy'}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function UniversalTokensPage() {
  const qc = useQueryClient();
  const authUser = useAuthStore((s) => s.user);
  const isSuperAdmin = authUser?.role === 'super_admin';
  const { data, isLoading, isError } = useQuery<UniversalToken[]>({
    queryKey: ['universal-tokens'],
    queryFn: async () => {
      const { data } = await api.get<UniversalToken[]>('/universal-tokens');
      return data;
    },
  });

  const deleteToken = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/universal-tokens/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['universal-tokens'] }),
  });

  const regenerateToken = useMutation<CreatedToken, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.post<CreatedToken>(`/universal-tokens/${id}/regenerate`);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['universal-tokens'] });
      setCreatedToken(data);
    },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [createdToken, setCreatedToken] = useState<CreatedToken | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deletingToken = data?.find((t) => t.id === deletingId);

  if (isLoading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading…</div>;
  if (isError) return <div className="flex h-64 items-center justify-center text-red-500">Failed to load tokens.</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Universal Tokens</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Universal tokens allow agents to connect without a pre-created instance. The instance is auto-created on first connect.
          </p>
        </div>
        {isSuperAdmin && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Create Token
          </Button>
        )}
      </div>

      {/* Token list */}
      {data?.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500">
          No universal tokens yet. Create one to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-gray-400" />
                    <CardTitle className="text-base">{t.name}</CardTitle>
                  </div>
                  <Badge variant={t.isActive ? 'success' : 'default'}>
                    {t.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Token value — always available for copy */}
                {t.tokenPlain && (
                  <TokenInlineReveal token={t.tokenPlain} />
                )}
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-400">
                    Created {new Date(t.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex items-center gap-1">
                    {isSuperAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Regenerate token (invalidates old one)"
                        loading={regenerateToken.isPending && regenerateToken.variables === t.id}
                        onClick={() => regenerateToken.mutate(t.id)}
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
                      </Button>
                    )}
                    {isSuperAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => setDeletingId(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <CreateTokenDialog
          onClose={() => setShowCreate(false)}
          onCreated={(t) => {
            setShowCreate(false);
            setCreatedToken(t);
          }}
        />
      )}

      {/* Token display modal */}
      {createdToken && (
        <TokenModal
          tokenName={createdToken.name}
          token={createdToken.token}
          onClose={() => setCreatedToken(null)}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={() => {
          if (deletingId) deleteToken.mutate(deletingId, { onSuccess: () => setDeletingId(null) });
        }}
        title={`Delete "${deletingToken?.name}"?`}
        description={<>Видалити universal token <strong>{deletingToken?.name}</strong>? Агенти що його використовують більше не зможуть підключитись.</>}
        confirmLabel="Delete"
        confirmVariant="destructive"
        loading={deleteToken.isPending}
      />
    </div>
  );
}
