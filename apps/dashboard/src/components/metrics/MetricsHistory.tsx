import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetricPoint {
  id: string;
  instanceId: string;
  recordedAt: string;
  uptimeSeconds: number;
  memoryMB: number;
  memoryTotalMB: number;
  cpuPercent: number;
  cpuLoad1m: number;
  diskUsedMB: number;
  diskTotalMB: number;
  diskFreeMB: number;
  nodeRedVersion: string | null;
  runMode: string | null;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }
function toLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtMB(mb: number) { return mb >= 1024 ? `${(mb/1024).toFixed(1)} GB` : `${Math.round(mb)} MB`; }
function fmtUptime(s: number) {
  const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function avg(arr: number[]) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color, fixedMax, height=48 }: { data:number[]; color:string; fixedMax?:number; height?:number }) {
  if (data.length < 2) return <div className="w-full flex items-center justify-center text-xs text-gray-400" style={{height}}>no data</div>;
  const W = 300, max = fixedMax ?? Math.max(...data, 1);
  const pts = data.map((v,i) => {
    const x = (i/(data.length-1))*W;
    const y = 2+(height-4)*(1-v/max);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const lx = W, ly = 2+(height-4)*(1-(data[data.length-1]/max));
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{height}} preserveAspectRatio="none">
      <line x1="0" y1={height/2} x2={W} y2={height/2} stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" className="text-gray-200 dark:text-gray-700"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={lx} cy={ly} r="2.5" fill={color}/>
    </svg>
  );
}

function MetricCard({ title, value, sub, children }: { title:string; value:string; sub?:string; children:React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/40 p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</span>
        <div className="text-right">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{value}</span>
          {sub && <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">avg {sub}</span>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: '30m', limit: 60   },
  { label: '1h',  limit: 120  },
  { label: '3h',  limit: 360  },
  { label: '6h',  limit: 720  },
  { label: '12h', limit: 1440 },
  { label: '24h', limit: 1440 },
] as const;

type PresetLabel = typeof PRESETS[number]['label'];

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useMetricsByLimit(instanceId: string, limit: number, enabled: boolean) {
  return useQuery<MetricPoint[]>({
    queryKey: ['metrics-limit', instanceId, limit],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<MetricPoint[]>(`/instances/${instanceId}/metrics?limit=${limit}`);
      return data;
    },
    refetchInterval: 35_000,
    staleTime: 20_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    // Only keep previous data if it was non-empty (avoid stale [] blocking new results)
    placeholderData: (prev: MetricPoint[] | undefined) => (prev && prev.length > 0 ? prev : undefined),
  });
}

function useMetricsByRange(instanceId: string, from: string, to: string, enabled: boolean) {
  return useQuery<MetricPoint[]>({
    queryKey: ['metrics-range', instanceId, from, to],
    enabled,
    queryFn: async () => {
      const f = encodeURIComponent(new Date(from).toISOString());
      const t = encodeURIComponent(new Date(to).toISOString());
      const { data } = await api.get<MetricPoint[]>(`/instances/${instanceId}/metrics?from=${f}&to=${t}`);
      return data;
    },
    refetchInterval: false,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev: MetricPoint[] | undefined) => (prev && prev.length > 0 ? prev : undefined),
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MetricsHistory({ instanceId }: { instanceId: string }) {
  const [preset, setPreset] = useState<PresetLabel>('1h');
  const [showCustom, setShowCustom] = useState(false);
  const [fromVal, setFromVal] = useState(() => toLocal(new Date(Date.now() - 3_600_000)));
  const [toVal,   setToVal]   = useState(() => toLocal(new Date()));
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo,   setAppliedTo]   = useState('');

  const limit = PRESETS.find(p => p.label === preset)!.limit;
  const customActive = showCustom && !!appliedFrom && !!appliedTo;

  const limitQ = useMetricsByLimit(instanceId, limit, !customActive);
  const rangeQ = useMetricsByRange(instanceId, appliedFrom, appliedTo, customActive);

  const q = customActive ? rangeQ : limitQ;
  const points: MetricPoint[] = q.data ?? [];
  const isFetching = q.isFetching && !q.isLoading; // background refresh (has old data)

  const cpuData  = points.map(p => p.cpuPercent);
  const ramData  = points.map(p => p.memoryMB);
  const diskData = points.map(p => p.diskUsedMB);
  const last     = points[points.length - 1] ?? null;

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mr-1">Period</span>
          {PRESETS.map(({ label }) => (
            <button key={label}
              onClick={() => { setPreset(label); setShowCustom(false); setAppliedFrom(''); setAppliedTo(''); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                !showCustom && preset === label
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >{label}</button>
          ))}
          <button
            onClick={() => setShowCustom(v => !v)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              showCustom ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >📅 Custom</button>
          {last && (
            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
              {isFetching && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"/>}
              {points.length} pts · {new Date(last.recordedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {showCustom && (
          <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">From</label>
              <input type="datetime-local" value={fromVal} onChange={e => setFromVal(e.target.value)}
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm px-2 py-1 text-gray-800 dark:text-gray-200"/>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">To</label>
              <input type="datetime-local" value={toVal} onChange={e => setToVal(e.target.value)}
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm px-2 py-1 text-gray-800 dark:text-gray-200"/>
            </div>
            <button onClick={() => { setAppliedFrom(fromVal); setAppliedTo(toVal); }}
              disabled={!fromVal || !toVal}
              className="self-end px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >Apply</button>
            {customActive && (
              <span className="self-end text-xs text-gray-400 pb-1">
                {appliedFrom.replace('T',' ')} → {appliedTo.replace('T',' ')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* States */}
      {q.isLoading && <div className="py-8 text-center text-sm text-gray-400">Loading…</div>}
      {q.isError   && <div className="py-6 text-center text-sm text-red-400">Error loading metrics</div>}
      {!q.isLoading && !q.isError && points.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">No data for this period</p>
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Collected every ~30s when agent is connected</p>
        </div>
      )}

      {/* Charts */}
      {!q.isLoading && !q.isError && points.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MetricCard title="CPU" value={`${(last?.cpuPercent??0).toFixed(1)}%`} sub={`${avg(cpuData).toFixed(1)}%`}>
            <Sparkline data={cpuData} color="#22c55e" fixedMax={100}/>
            <div className="flex justify-between text-xs text-gray-400 pt-0.5"><span>0%</span><span>100%</span></div>
          </MetricCard>

          <MetricCard title="RAM" value={fmtMB(last?.memoryMB??0)} sub={fmtMB(avg(ramData))}>
            <Sparkline data={ramData} color="#3b82f6" fixedMax={last?.memoryTotalMB||undefined}/>
            <div className="flex justify-between text-xs text-gray-400 pt-0.5">
              <span>0</span><span>{last?.memoryTotalMB ? fmtMB(last.memoryTotalMB) : 'max'}</span>
            </div>
          </MetricCard>

          <MetricCard title="Disk Used" value={fmtMB(last?.diskUsedMB??0)} sub={fmtMB(avg(diskData))}>
            <Sparkline data={diskData} color="#a855f7" fixedMax={last?.diskTotalMB||undefined}/>
            <div className="flex justify-between text-xs text-gray-400 pt-0.5">
              <span>0</span><span>{last?.diskTotalMB ? fmtMB(last.diskTotalMB) : 'max'}</span>
            </div>
          </MetricCard>

          <MetricCard title="Uptime" value={fmtUptime(last?.uptimeSeconds??0)}>
            <div className="flex items-center gap-2 pt-1">
              {last?.runMode && <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{last.runMode}</span>}
              <span className="text-xs text-gray-400">{last?.nodeRedVersion??''}</span>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{points.length} data points</div>
          </MetricCard>
        </div>
      )}
    </div>
  );
}
