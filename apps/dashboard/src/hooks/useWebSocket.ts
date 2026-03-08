import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWSStore } from '@/store/ws';
import { useAuthStore } from '@/store/auth';
import type { Instance, InstanceStatus, InstanceStatusEvent } from '@/types/api';

interface InstancesStatusPayload {
  instanceId: string;
  status: InstanceStatus;
  uptimeSeconds?: number;
  nodeRedVersion?: string;
  nodeVersion?: string;
}

interface WSMessage {
  type: 'instances:status' | 'instance:status';
  payload: InstancesStatusPayload[] | InstanceStatusEvent;
}

const RECONNECT_DELAY_MS = 3_000;

function getWsUrl() {
  const token = useAuthStore.getState().token;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const base = `${proto}//${window.location.host}/ws`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

/** Map InstanceStatusEvent → Instance fields (instanceId → id) */
function eventToInstancePatch(upd: InstanceStatusEvent): Partial<Instance> {
  const { instanceId: _instanceId, ...rest } = upd;
  return rest as Partial<Instance>;
}

export function useWebSocket() {
  const qc = useQueryClient();
  const setConnected = useWSStore((s) => s.setConnected);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);

  useEffect(() => {
    unmounted.current = false;

    function connect() {
      if (unmounted.current) return;

      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onclose = () => {
        setConnected(false);
        if (!unmounted.current) {
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = () => ws.close();

      ws.onmessage = (event: MessageEvent<string>) => {
        let msg: WSMessage;
        try {
          msg = JSON.parse(event.data) as WSMessage;
        } catch {
          return;
        }

        // ── Initial snapshot on connect ──────────────────────────────────
        if (msg.type === 'instances:status') {
          const updates = msg.payload as InstancesStatusPayload[];
          qc.setQueryData<Instance[]>(['instances'], (prev) => {
            if (!prev) return prev;
            return prev.map((inst) => {
              const upd = updates.find((u) => u.instanceId === inst.id);
              if (!upd) return inst;
              const { instanceId: _instanceId2, ...patch } = upd;
              return { ...inst, ...patch };
            });
          });
        }

        // ── Live update (heartbeat / status change) ──────────────────────
        if (msg.type === 'instance:status') {
          const upd = msg.payload as InstanceStatusEvent;
          const patch = eventToInstancePatch(upd);

          // Update list cache
          qc.setQueryData<Instance[]>(['instances'], (prev) => {
            if (!prev) return prev;
            return prev.map((inst) =>
              inst.id === upd.instanceId ? { ...inst, ...patch } : inst,
            );
          });

          // Update detail cache
          qc.setQueryData<Instance>(['instances', upd.instanceId], (prev) => {
            if (!prev) return prev;
            return { ...prev, ...patch };
          });
        }
      };
    }

    connect();

    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      setConnected(false);
    };
  }, [qc, setConnected]);

  return { connected: useWSStore((s) => s.connected) };
}
