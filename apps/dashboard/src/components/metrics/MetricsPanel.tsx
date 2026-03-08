import type { Instance } from '@/types/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  value: number; // 0-100
  colorClass: string;
  label?: string;
}

function ProgressBar({ value, colorClass, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {label && (
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0 w-28 text-right">
          {label}
        </span>
      )}
    </div>
  );
}

function cpuColor(pct: number): string {
  if (pct >= 85) return 'bg-red-500';
  if (pct >= 60) return 'bg-yellow-400';
  return 'bg-green-500';
}

function memColor(pct: number): string {
  if (pct >= 85) return 'bg-red-500';
  if (pct >= 60) return 'bg-yellow-400';
  return 'bg-blue-500';
}

function diskColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 75) return 'bg-yellow-400';
  return 'bg-violet-500';
}

// ─── Run Mode Badge ───────────────────────────────────────────────────────────

function RunModeBadge({ mode }: { mode: string }) {
  const colors: Record<string, string> = {
    pm2: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    systemd: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    direct: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  };
  const cls = colors[mode.toLowerCase()] ?? colors.direct;
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {mode}
    </span>
  );
}

// ─── MetricsPanel ─────────────────────────────────────────────────────────────

interface MetricsPanelProps {
  instance: Instance;
}

export function MetricsPanel({ instance: inst }: MetricsPanelProps) {
  const hasCpu = inst.cpuPercent !== undefined;
  const hasMemory = inst.memoryMB !== undefined && inst.memoryTotalMB !== undefined;
  const hasDisk = inst.diskUsedMB !== undefined && inst.diskTotalMB !== undefined;
  const hasUptime = inst.uptimeSeconds !== undefined;
  const hasRunMode = inst.runMode !== undefined;

  if (!hasCpu && !hasMemory && !hasDisk && !hasUptime && !hasRunMode) return null;

  const cpuPct = hasCpu ? inst.cpuPercent! : 0;
  const memPct = hasMemory ? Math.round((inst.memoryMB! / inst.memoryTotalMB!) * 100) : 0;
  const diskPct = hasDisk ? Math.round((inst.diskUsedMB! / inst.diskTotalMB!) * 100) : 0;

  return (
    <div className="mt-3 rounded-lg border border-gray-100 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/40 px-3 py-2.5 space-y-1.5">
      {/* CPU */}
      {hasCpu && (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">CPU</span>
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {cpuPct.toFixed(1)}%
              {inst.cpuLoad1m !== undefined && (
                <span className="ml-1 text-gray-400 dark:text-gray-500">load {inst.cpuLoad1m.toFixed(2)}</span>
              )}
            </span>
          </div>
          <ProgressBar value={cpuPct} colorClass={cpuColor(cpuPct)} />
        </div>
      )}

      {/* RAM */}
      {hasMemory && (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">RAM</span>
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {formatMB(inst.memoryMB!)} / {formatMB(inst.memoryTotalMB!)}
              <span className="ml-1 text-gray-400 dark:text-gray-500">({memPct}%)</span>
            </span>
          </div>
          <ProgressBar value={memPct} colorClass={memColor(memPct)} />
        </div>
      )}

      {/* DISK */}
      {hasDisk && (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Disk</span>
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {formatMB(inst.diskUsedMB!)} / {formatMB(inst.diskTotalMB!)}
              <span className="ml-1 text-gray-400 dark:text-gray-500">({diskPct}%)</span>
            </span>
          </div>
          <ProgressBar value={diskPct} colorClass={diskColor(diskPct)} />
        </div>
      )}

      {/* Uptime + Run mode row */}
      {(hasUptime || hasRunMode) && (
        <div className="flex items-center justify-between pt-0.5">
          {hasUptime && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ⏱ Uptime: <span className="text-gray-700 dark:text-gray-200 font-medium">{formatUptime(inst.uptimeSeconds!)}</span>
            </span>
          )}
          {hasRunMode && <RunModeBadge mode={inst.runMode!} />}
        </div>
      )}
    </div>
  );
}
