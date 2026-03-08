import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { createHash, randomUUID } from 'crypto';
import type { WebSocket } from '@fastify/websocket';
import { and, eq, sql } from 'drizzle-orm';

import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import instanceRoutes from './routes/instances.js';
import userRoutes from './routes/users.js';
import projectRoutes from './routes/projects.js';
import auditRoutes from './routes/audit.js';
import workspaceUsersRoutes from './routes/workspace-users.js';
import workspaceRoutes from './routes/workspaces.js';
import universalTokenRoutes from './routes/universalTokens.js';
import { db, instances, instanceMetrics, instanceUsers, instanceProjects, universalTokens } from './db/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    // Send a command to a connected agent; returns true if delivered
    sendAgentCommand: (instanceId: string, action: string, params?: Record<string, unknown>) => boolean;
    // Send a command and wait for command_result response
    sendCommandAndWait: (instanceId: string, action: string, params?: Record<string, unknown>, timeoutMs?: number) => Promise<unknown>;
  }
}

// Map of instanceId → WebSocket (agent connections)
export const AGENT_SOCKETS = new Map<string, WebSocket>();
// Set of dashboard connections
const WS_CLIENTS = new Set<WebSocket>();
// Pending command requests awaiting command_result from agent
const PENDING_REQUESTS = new Map<string, {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}>();

// ─── Sync users + projects from agent into DB ─────────────────────────────────

async function syncInstanceData(app: ReturnType<typeof Fastify>, instanceId: string): Promise<void> {
  // Wait a bit for agent to be ready
  await new Promise(r => setTimeout(r, 2000));

  // Sync users — upsert only, never delete (fleet-managed users added via nr_create_user must persist)
  try {
    const users = await (app as any).sendCommandAndWait(instanceId, 'get_users', {}, 10000) as any[];
    if (Array.isArray(users) && users.length > 0) {
      await db.insert(instanceUsers).values(
        users.map(u => ({
          instanceId,
          username: u.username ?? u.login ?? String(u),
          role: (u.role ?? (u.permissions?.includes?.('*') ? 'admin' : 'read-only')) as string,
          permissions: (u.permissions ?? []) as string[],
          syncedAt: new Date(),
        }))
      ).onConflictDoUpdate({
        target: [instanceUsers.instanceId, instanceUsers.username],
        set: { role: sql`excluded.role`, syncedAt: sql`excluded.synced_at` },
      });
      app.log.info(`Synced ${users.length} users for instance ${instanceId}`);
    }
  } catch (err) {
    app.log.warn(`Failed to sync users for ${instanceId}: ${err}`);
  }

  // Sync projects
  try {
    const projects = await (app as any).sendCommandAndWait(instanceId, 'get_projects', {}, 15000) as any[];
    if (Array.isArray(projects)) {
      await db.delete(instanceProjects).where(eq(instanceProjects.instanceId, instanceId));
      if (projects.length > 0) {
        await db.insert(instanceProjects).values(
          projects.map(p => ({
            instanceId,
            name: p.name,
            hasGit: p.hasGit ?? false,
            branch: p.branch ?? null,
            remoteUrl: p.remote ?? null,
            lastCommitHash: p.lastCommit?.hash ?? null,
            lastCommitMessage: p.lastCommit?.message ?? null,
            lastCommitDate: p.lastCommit?.date ?? null,
            isDirty: p.isDirty ?? false,
            syncedAt: new Date(),
          }))
        );
      }
      app.log.info(`Synced ${projects.length} projects for instance ${instanceId}`);
    }
  } catch (err) {
    app.log.warn(`Failed to sync projects for ${instanceId}: ${err}`);
  }
}

export function broadcastStatus(instanceId: string, status: string, extra?: Record<string, unknown>) {
  const event = JSON.stringify({
    type: 'instance:status',
    payload: { instanceId, status, timestamp: new Date().toISOString(), ...extra },
  });
  for (const client of WS_CLIENTS) {
    if (client.readyState === client.OPEN) {
      client.send(event);
    }
  }
}

export async function buildApp() {
  const app = Fastify({
    bodyLimit: 1_048_576, // 1MB
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  });

  // ─── Plugins ──────────────────────────────────────────────────────────────

  await app.register(cors, {
    origin: (origin, cb) => {
      const allowed = (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:5173,http://localhost:3000')
        .split(',')
        .map(o => o.trim());
      // Allow requests without origin (mobile apps, curl, server-to-server)
      if (!origin || allowed.includes(origin) || allowed.includes('*')) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin ${origin} not allowed`), false);
      }
    },
    credentials: true,
  });

  const jwtSecret = process.env['JWT_SECRET'];
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET environment variable is required and must be at least 32 characters');
  }
  await app.register(jwt, {
    secret: jwtSecret,
  });

  await app.register(websocket);
  await app.register(authPlugin);

  // ─── Helper: send command to agent (fire-and-forget) ──────────────────────
  app.decorate('sendAgentCommand', (instanceId: string, action: string, params: Record<string, unknown> = {}): boolean => {
    const socket = AGENT_SOCKETS.get(instanceId);
    if (!socket || socket.readyState !== socket.OPEN) return false;
    socket.send(JSON.stringify({
      type: 'command',
      payload: {
        commandId: randomUUID(),
        action,
        params,
      },
    }));
    return true;
  });

  // ─── Helper: send command and wait for command_result ─────────────────────
  app.decorate('sendCommandAndWait', async function(instanceId: string, action: string, params: Record<string, unknown> = {}, timeoutMs = 10000): Promise<unknown> {
    const socket = AGENT_SOCKETS.get(instanceId);
    if (!socket || socket.readyState !== socket.OPEN) throw new Error('Agent not connected');
    const commandId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        PENDING_REQUESTS.delete(commandId);
        reject(new Error('Agent command timeout'));
      }, timeoutMs);
      PENDING_REQUESTS.set(commandId, { resolve, reject, timer });
      socket.send(JSON.stringify({ type: 'command', payload: { commandId, action, params } }));
    });
  });

  // ─── Routes ───────────────────────────────────────────────────────────────

  await app.register(authRoutes);
  await app.register(instanceRoutes);
  await app.register(userRoutes);
  await app.register(projectRoutes);
  await app.register(auditRoutes);
  await app.register(workspaceUsersRoutes);
  await app.register(workspaceRoutes);
  await app.register(universalTokenRoutes);

  // ─── WebSocket — Agent + Dashboard ────────────────────────────────────────

  app.get('/ws', { websocket: true }, async (socket, request) => {
    let agentInstanceId: string | null = null;
    let isUniversalConnection = false;

    // ─── Buffer messages during async authentication ──────────────────────────
    // We must register message handler BEFORE any await, otherwise early messages
    // (like 'register') arrive during DB queries and are permanently lost.
    const pendingMessages: (Buffer | string)[] = [];
    let authComplete = false;

    socket.on('message', async (raw: Buffer | string) => {
      if (!authComplete) {
        pendingMessages.push(raw);
        return;
      }
      await handleMessage(raw);
    });

    // ─── Authentication ───────────────────────────────────────────────────────
    // Support token via Authorization header OR ?token= query param (browsers can't set WS headers)
    const queryToken = (request.query as Record<string, string>)['token'] ?? '';
    const authHeader = (request.headers['authorization'] as string | undefined)
      ?? (queryToken ? `Bearer ${queryToken}` : '');

    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const tokenHash = createHash('sha256').update(token).digest('hex');

      // Look up by instance token first
      const [inst] = await db
        .select()
        .from(instances)
        .where(eq(instances.tokenHash, tokenHash))
        .limit(1);

      if (inst) {
        agentInstanceId = inst.id;
        AGENT_SOCKETS.set(inst.id, socket);

        await db.update(instances)
          .set({ status: 'online', updatedAt: new Date() })
          .where(eq(instances.id, inst.id));
        broadcastStatus(inst.id, 'online');

        app.log.info(`Agent connected: ${inst.name} (${inst.id})`);
      } else {
        // Fallback: check universal tokens
        const [utRow] = await db.select().from(universalTokens)
          .where(and(eq(universalTokens.tokenHash, tokenHash), eq(universalTokens.isActive, true)))
          .limit(1);

        if (utRow) {
          isUniversalConnection = true;
          app.log.info(`Universal token connection accepted: ${utRow.name}`);
        }
        // If neither agent nor universal token: may be a dashboard JWT — fall through to JWT check below
      }
    }

    // Auth done — mark complete and drain buffered messages
    authComplete = true;
    for (const raw of pendingMessages) {
      await handleMessage(raw);
    }

    // ─── Message processor ────────────────────────────────────────────────────
    async function handleMessage(raw: Buffer | string) {
      try {
        const msg = JSON.parse(raw.toString()) as { type: string; payload?: Record<string, unknown> };

        // ── register: agent sends on connect ──────────────────────────────
        if (msg.type === 'register') {
          // Handle universal token registration (find or create instance)
          if (isUniversalConnection && !agentInstanceId) {
            const p = (msg.payload ?? {}) as {
              instanceName?: string;
              host?: string;
              port?: number;
              tags?: string[];
              nodeRedVersion?: string;
              nodeVersion?: string;
              uptimeSeconds?: number;
              osName?: string;
              osVersion?: string;
              osArch?: string;
            };
            const instanceName = p.instanceName ?? `universal-${Date.now()}`;

            // Find existing instance by name or create new
            let [existing] = await db.select().from(instances)
              .where(eq(instances.name, instanceName)).limit(1);

            if (!existing) {
              const [created] = await db.insert(instances).values({
                name: instanceName,
                host: p.host ?? 'localhost',
                port: p.port ?? 1880,
                tags: p.tags ?? [],
                status: 'online',
              }).returning();
              existing = created;
              app.log.info(`Universal token: auto-created instance "${instanceName}" (${existing.id})`);
            } else {
              await db.update(instances).set({
                status: 'online',
                host: p.host ?? existing.host,
                port: p.port ?? existing.port,
                updatedAt: new Date(),
              }).where(eq(instances.id, existing.id));
              app.log.info(`Universal token: reused instance "${instanceName}" (${existing.id})`);
            }

            agentInstanceId = existing.id;
            AGENT_SOCKETS.set(existing.id, socket);
            WS_CLIENTS.delete(socket); // remove from dashboard set — it's an agent, not a browser
            broadcastStatus(existing.id, 'online');
          }

          if (agentInstanceId) {
            const p = (msg.payload ?? {}) as {
              nodeRedVersion?: string;
              nodeVersion?: string;
              uptimeSeconds?: number;
              capabilities?: string[];
              osName?: string;
              osVersion?: string;
              osArch?: string;
              localIp?: string;
              publicIp?: string;
            };

            await db.update(instances)
              .set({
                status: 'online',
                nodeRedVersion: p.nodeRedVersion ?? null,
                nodeVersion:    p.nodeVersion    ?? null,
                osName:         p.osName         ?? null,
                osVersion:      p.osVersion      ?? null,
                osArch:         p.osArch         ?? null,
                localIp:        p.localIp        ?? null,
                publicIp:       p.publicIp       ?? null,
                uptimeSeconds:  p.uptimeSeconds  ?? 0,
                updatedAt: new Date(),
              })
              .where(eq(instances.id, agentInstanceId));

            broadcastStatus(agentInstanceId, 'online', {
              nodeRedVersion: p.nodeRedVersion,
              nodeVersion:    p.nodeVersion,
              osName:         p.osName,
              osVersion:      p.osVersion,
              osArch:         p.osArch,
              localIp:        p.localIp,
              publicIp:       p.publicIp,
              uptimeSeconds:  p.uptimeSeconds,
            });

            app.log.info(`Agent registered: NR v${p.nodeRedVersion ?? '?'} / Node ${p.nodeVersion ?? '?'} / OS ${p.osName ?? '?'} ${p.osVersion ?? ''} ${p.osArch ?? ''} | localIp=${p.localIp ?? '-'} publicIp=${p.publicIp ?? '-'}`);
            // Async sync — fire-and-forget
            syncInstanceData(app, agentInstanceId).catch(() => {});
          }
        }

        // ── heartbeat: every 30s ───────────────────────────────────────────
        if (msg.type === 'heartbeat' && agentInstanceId) {
          const p = (msg.payload ?? {}) as {
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
          };

          await db.update(instances)
            .set({
              uptimeSeconds:  p.uptimeSeconds ?? 0,
              nodeRedVersion: p.nodeRedVersion ?? undefined,
              nodeVersion:    p.nodeVersion    ?? undefined,
              updatedAt: new Date(),
            })
            .where(eq(instances.id, agentInstanceId));

          // Persist metrics snapshot for time-series / history
          await db.insert(instanceMetrics).values({
            instanceId:    agentInstanceId,
            uptimeSeconds: p.uptimeSeconds  ?? 0,
            memoryMB:      p.memoryMB       ?? 0,
            memoryTotalMB: p.memoryTotalMB  ?? 0,
            cpuPercent:    p.cpuPercent     ?? 0,
            cpuLoad1m:     p.cpuLoad1m      ?? 0,
            diskUsedMB:    p.diskUsedMB     ?? 0,
            diskTotalMB:   p.diskTotalMB    ?? 0,
            diskFreeMB:    p.diskFreeMB     ?? 0,
            nodeRedVersion: p.nodeRedVersion ?? null,
            runMode:       p.runMode        ?? null,
          });

          // Broadcast all metrics to dashboard
          broadcastStatus(agentInstanceId, 'online', {
            uptimeSeconds:  p.uptimeSeconds,
            memoryMB:       p.memoryMB,
            memoryTotalMB:  p.memoryTotalMB,
            cpuPercent:     p.cpuPercent,
            cpuLoad1m:      p.cpuLoad1m,
            diskUsedMB:     p.diskUsedMB,
            diskTotalMB:    p.diskTotalMB,
            diskFreeMB:     p.diskFreeMB,
            nodeRedVersion: p.nodeRedVersion,
            nodeVersion:    p.nodeVersion,
            runMode:        p.runMode,
          });
        }

        // ── update_info: agent sends updated info (e.g. publicIp detected async) ──
        if (msg.type === 'update_info' && agentInstanceId) {
          const p = (msg.payload ?? {}) as { publicIp?: string; localIp?: string };
          const update: Record<string, unknown> = { updatedAt: new Date() };
          if (p.publicIp) update.publicIp = p.publicIp;
          if (p.localIp)  update.localIp  = p.localIp;
          if (Object.keys(update).length > 1) {
            await db.update(instances).set(update as any).where(eq(instances.id, agentInstanceId));
            app.log.info(`Agent update_info [${agentInstanceId}]: publicIp=${p.publicIp ?? '-'} localIp=${p.localIp ?? '-'}`);
          }
        }

        // ── command_result: response from agent (fire-and-forget acks + sendCommandAndWait) ──
        if ((msg.type === 'command_result' || msg.type === 'ack') && agentInstanceId) {
          const p = (msg.payload ?? {}) as { commandId: string; success: boolean; result?: unknown; error?: string };
          app.log.info(`Agent command_result [${p.commandId}]: ${p.success ? 'OK' : `FAIL — ${p.error}`}`);
          // Resolve pending sendCommandAndWait promise if one exists
          const pending = PENDING_REQUESTS.get(p.commandId);
          if (pending) {
            clearTimeout(pending.timer);
            PENDING_REQUESTS.delete(p.commandId);
            if (p.success) pending.resolve(p.result);
            else pending.reject(new Error(p.error ?? 'Command failed'));
          }
        }

      } catch (err) {
        app.log.warn(`WS message parse error: ${err}`);
      }
    } // end handleMessage

    socket.on('close', async () => {
      if (agentInstanceId) {
        AGENT_SOCKETS.delete(agentInstanceId);
        await db.update(instances)
          .set({ status: 'offline', uptimeSeconds: 0, updatedAt: new Date() })
          .where(eq(instances.id, agentInstanceId));
        broadcastStatus(agentInstanceId, 'offline');
        app.log.info(`Agent disconnected: ${agentInstanceId}`);
      } else {
        WS_CLIENTS.delete(socket);
      }
    });

    // ─── Dashboard snapshot (async, after message handler is registered) ───
    if (!agentInstanceId) {
      if (!isUniversalConnection) {
        // Verify dashboard user JWT before adding to WS_CLIENTS
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        if (!token) {
          socket.close(1008, 'Authentication required');
          return;
        }
        try {
          await app.jwt.verify(token);
        } catch {
          socket.close(1008, 'Invalid or missing JWT');
          return;
        }
      }
      WS_CLIENTS.add(socket);
      // Send current snapshot to dashboard client
      const allInstances = await db.select().from(instances);
      const snapshot = allInstances.map((i) => ({
        instanceId: i.id,
        status: i.status,
        uptimeSeconds: i.uptimeSeconds,
        nodeRedVersion: i.nodeRedVersion,
        nodeVersion: i.nodeVersion,
      }));
      socket.send(JSON.stringify({ type: 'instances:status', payload: snapshot }));
    }
  });

  // ─── Health check ─────────────────────────────────────────────────────────

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  return app;
}
