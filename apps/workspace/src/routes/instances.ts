import type { FastifyPluginAsync } from 'fastify';
import { randomBytes, createHash } from 'crypto';
import { eq, inArray, desc, asc, gte, lte, and } from 'drizzle-orm';
import { db, instances, auditLogs, instanceMetrics } from '../db/index.js';
import { getUserWorkspaceIds, getUserWorkspaceRole } from '../plugins/auth.js';

function generateToken(): { plaintext: string; hash: string } {
  const plaintext = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, hash };
}

function mapInstance(inst: typeof instances.$inferSelect) {
  return {
    id: inst.id,
    name: inst.name,
    host: inst.host,
    port: inst.port,
    tags: (inst.tags as string[]) ?? [],
    status: inst.status,
    nodeRedVersion: inst.nodeRedVersion,
    nodeVersion:    inst.nodeVersion,
    osName:         inst.osName    ?? null,
    osVersion:      inst.osVersion ?? null,
    osArch:         inst.osArch    ?? null,
    localIp:        inst.localIp   ?? null,
    publicIp:       inst.publicIp  ?? null,
    uptimeSeconds: inst.uptimeSeconds ?? 0,
    workspaceId: inst.workspaceId,
    createdAt: inst.createdAt.toISOString(),
    updatedAt: inst.updatedAt.toISOString(),
  };
}

const instanceRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /instances
  fastify.get<{ Querystring: { workspaceId?: string } }>(
    '/instances',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { workspaceId } = request.query;
      const user = request.user;

      if (user.role === 'super_admin') {
        const rows = workspaceId
          ? await db.select().from(instances).where(eq(instances.workspaceId, workspaceId))
          : await db.select().from(instances);
        return reply.status(200).send(rows.map(mapInstance));
      }

      // Non-super_admin: only instances in accessible workspaces
      const wsIds = await getUserWorkspaceIds(user.id);
      if (wsIds.size === 0) return reply.status(200).send([]);

      const wsIdArray = Array.from(wsIds);

      if (workspaceId) {
        if (!wsIds.has(workspaceId)) {
          return reply.status(403).send({ error: 'Forbidden', message: 'No access to this workspace' });
        }
        const rows = await db.select().from(instances).where(eq(instances.workspaceId, workspaceId));
        return reply.status(200).send(rows.map(mapInstance));
      }

      const rows = await db.select().from(instances).where(inArray(instances.workspaceId, wsIdArray));
      return reply.status(200).send(rows.map(mapInstance));
    },
  );

  // GET /instances/:id
  fastify.get<{ Params: { id: string } }>(
    '/instances/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user;
      const [inst] = await db.select().from(instances).where(eq(instances.id, request.params.id)).limit(1);
      if (!inst) return reply.status(404).send({ error: 'Not Found', message: 'Instance not found' });

      if (user.role !== 'super_admin') {
        if (!inst.workspaceId) {
          return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
        }
        const wsIds = await getUserWorkspaceIds(user.id);
        if (!wsIds.has(inst.workspaceId)) {
          return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
        }
      }

      return reply.status(200).send(mapInstance(inst));
    },
  );

  // POST /instances
  fastify.post<{ Body: { name: string; host: string; port: number; tags?: string[]; workspaceId?: string } }>(
    '/instances',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['name', 'host', 'port'],
          properties: {
            name: { type: 'string' },
            host: { type: 'string' },
            port: { type: 'number' },
            tags: { type: 'array', items: { type: 'string' } },
            workspaceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user;
      const { name, host, port, tags, workspaceId } = request.body;

      if (user.role !== 'super_admin') {
        if (!workspaceId) {
          return reply.status(400).send({ error: 'Bad Request', message: 'workspaceId is required for non-super_admin users' });
        }
        const wsIds = await getUserWorkspaceIds(user.id);
        if (!wsIds.has(workspaceId)) {
          return reply.status(403).send({ error: 'Forbidden', message: 'No access to this workspace' });
        }
      }

      const { plaintext, hash } = generateToken();
      const [inst] = await db
        .insert(instances)
        .values({
          name,
          host,
          port,
          tags: tags ?? [],
          status: 'unknown',
          workspaceId: workspaceId ?? null,
          tokenHash: hash,
        })
        .returning();

      const actor = request.user.email;
      await db.insert(auditLogs).values({
        action: 'instance.create',
        actor,
        targetId: inst.id,
        targetName: inst.name,
        details: { name: inst.name },
        instanceId: inst.id,
      });

      return reply.status(201).send({ ...mapInstance(inst), agentToken: plaintext });
    },
  );

  // PUT /instances/:id
  fastify.put<{ Params: { id: string }; Body: { name?: string; host?: string; port?: number; tags?: string[] } }>(
    '/instances/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            host: { type: 'string' },
            port: { type: 'number' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user;

      if (user.role !== 'super_admin') {
        const [existing] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
        if (!existing) return reply.status(404).send({ error: 'Not Found', message: 'Instance not found' });
        if (!existing.workspaceId) {
          return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
        }
        const wsIds = await getUserWorkspaceIds(user.id);
        if (!wsIds.has(existing.workspaceId)) {
          return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
        }
      }

      const { name, host, port, tags } = request.body;
      const updateData: Partial<typeof instances.$inferInsert> = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (host !== undefined) updateData.host = host;
      if (port !== undefined) updateData.port = port;
      if (tags !== undefined) updateData.tags = tags;

      const [inst] = await db.update(instances).set(updateData).where(eq(instances.id, id)).returning();
      if (!inst) return reply.status(404).send({ error: 'Not Found', message: 'Instance not found' });

      const actor = request.user.email;
      await db.insert(auditLogs).values({
        action: 'instance.update',
        actor,
        targetId: id,
        targetName: inst.name,
        details: { changes: request.body },
        instanceId: id,
      });

      return reply.status(200).send(mapInstance(inst));
    },
  );

  // DELETE /instances/:id
  fastify.delete<{ Params: { id: string } }>(
    '/instances/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user;

      if (user.role !== 'super_admin') {
        const [existing] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
        if (!existing) return reply.status(404).send({ error: 'Not Found', message: 'Instance not found' });
        if (!existing.workspaceId) {
          return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
        }
        const wsRole = await getUserWorkspaceRole(user.id, existing.workspaceId);
        if (wsRole !== 'workspace_admin') {
          return reply.status(403).send({ error: 'Forbidden', message: 'Only workspace_admin can delete instances' });
        }
      }

      const [deleted] = await db.delete(instances).where(eq(instances.id, id)).returning();
      if (!deleted) return reply.status(404).send({ error: 'Not Found', message: 'Instance not found' });

      const actor = request.user.email;
      await db.insert(auditLogs).values({
        action: 'instance.delete',
        actor,
        targetId: id,
        targetName: deleted.name,
        details: { action: 'delete' },
        instanceId: id,
      });

      return reply.status(204).send();
    },
  );

  // POST /instances/:id/start
  fastify.post<{ Params: { id: string } }>(
    '/instances/:id/start',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
      if (!inst) return reply.status(404).send({ error: 'Not Found', message: 'Instance not found' });

      const delivered = fastify.sendAgentCommand(id, 'start');
      const actor = request.user.email;
      await db.insert(auditLogs).values({ action: 'instance.start', actor, instanceId: id, targetId: id, targetName: inst.name, details: { agentDelivered: delivered } });
      return reply.status(200).send({ ...mapInstance(inst), agentDelivered: delivered });
    },
  );

  // POST /instances/:id/stop
  fastify.post<{ Params: { id: string } }>(
    '/instances/:id/stop',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
      if (!inst) return reply.status(404).send({ error: 'Not Found', message: 'Instance not found' });

      const delivered = fastify.sendAgentCommand(id, 'stop');
      const actor = request.user.email;
      await db.insert(auditLogs).values({ action: 'instance.stop', actor, instanceId: id, targetId: id, targetName: inst.name, details: { agentDelivered: delivered } });
      return reply.status(200).send({ ...mapInstance(inst), agentDelivered: delivered });
    },
  );

  // POST /instances/:id/restart
  fastify.post<{ Params: { id: string } }>(
    '/instances/:id/restart',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
      if (!inst) return reply.status(404).send({ error: 'Not Found', message: 'Instance not found' });

      const delivered = fastify.sendAgentCommand(id, 'restart');
      const actor = request.user.email;
      await db.insert(auditLogs).values({ action: 'instance.restart', actor, instanceId: id, targetId: id, targetName: inst.name, details: { reason: 'Manual restart', agentDelivered: delivered } });
      return reply.status(200).send({ ...mapInstance(inst), agentDelivered: delivered });
    },
  );

  // POST /instances/bulk-action
  fastify.post<{ Body: { ids: string[]; action: 'start' | 'stop' | 'restart' } }>(
    '/instances/bulk-action',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['ids', 'action'],
          properties: {
            ids: { type: 'array', items: { type: 'string' } },
            action: { type: 'string', enum: ['start', 'stop', 'restart'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { ids, action } = request.body;
      const user = request.user;
      const actor = user.email;

      // For non-super_admin: filter IDs to only accessible instances
      let filteredIds = ids;
      if (user.role !== 'super_admin') {
        const wsIds = await getUserWorkspaceIds(user.id);
        if (wsIds.size === 0) {
          return reply.status(200).send({ results: ids.map((id) => ({ id, success: false, error: 'Access denied' })) });
        }
        const accessibleInstances = await db.select({ id: instances.id }).from(instances)
          .where(inArray(instances.workspaceId, Array.from(wsIds)));
        const accessibleIds = new Set(accessibleInstances.map((i) => i.id));
        filteredIds = ids.filter((id) => accessibleIds.has(id));
      }

      const newStatus = action === 'stop' ? 'offline' : 'online';
      const auditAction = `instance.${action}` as const;

      const updated = filteredIds.length > 0
        ? await db.update(instances).set({ status: newStatus, updatedAt: new Date() }).where(inArray(instances.id, filteredIds)).returning()
        : [];

      const results = ids.map((id) => {
        if (!filteredIds.includes(id)) return { id, success: false, error: 'Access denied' };
        const inst = updated.find((i) => i.id === id);
        return { id, success: !!inst, error: inst ? undefined : 'Instance not found' };
      });

      for (const inst of updated) {
        await db.insert(auditLogs).values({
          action: auditAction,
          actor,
          instanceId: inst.id,
          targetId: inst.id,
          targetName: inst.name,
          details: { reason: 'Bulk action' },
        });
      }

      return reply.status(200).send({ results });
    },
  );

  // GET /instances/:id/token — regenerate token
  fastify.get<{ Params: { id: string } }>(
    '/instances/:id/token',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const { plaintext, hash } = generateToken();
      const [inst] = await db
        .update(instances)
        .set({ tokenHash: hash, updatedAt: new Date() })
        .where(eq(instances.id, id))
        .returning();
      if (!inst) return reply.status(404).send({ error: 'Not Found', message: 'Instance not found' });

      const actor = request.user.email;
      await db.insert(auditLogs).values({
        action: 'instance.token_regen',
        actor,
        targetId: id,
        targetName: inst.name,
        details: {},
        instanceId: id,
      });

      return reply.status(200).send({ agentToken: plaintext });
    },
  );

  // GET /instances/:id/metrics?limit=60&from=ISO&to=ISO
  fastify.get<{ Params: { id: string }; Querystring: { limit?: string; from?: string; to?: string } }>(
    '/instances/:id/metrics',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const { limit: limitStr, from, to } = request.query;

      if (from || to) {
        const conditions = [eq(instanceMetrics.instanceId, id)];
        if (from) conditions.push(gte(instanceMetrics.recordedAt, new Date(from)));
        if (to)   conditions.push(lte(instanceMetrics.recordedAt, new Date(to)));

        const rows = await db
          .select()
          .from(instanceMetrics)
          .where(and(...conditions))
          .orderBy(asc(instanceMetrics.recordedAt))
          .limit(2000);

        return reply.status(200).send(rows);
      }

      const limit = Math.min(Number(limitStr ?? 60), 1440);
      const rows = await db
        .select()
        .from(instanceMetrics)
        .where(eq(instanceMetrics.instanceId, id))
        .orderBy(desc(instanceMetrics.recordedAt))
        .limit(limit);

      return reply.status(200).send(rows.reverse());
    },
  );

  // GET /instances/:id/metrics/latest
  fastify.get<{ Params: { id: string } }>(
    '/instances/:id/metrics/latest',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const [row] = await db
        .select()
        .from(instanceMetrics)
        .where(eq(instanceMetrics.instanceId, id))
        .orderBy(desc(instanceMetrics.recordedAt))
        .limit(1);

      if (!row) return reply.status(404).send({ error: 'No metrics yet' });
      return reply.status(200).send(row);
    },
  );
};

export default instanceRoutes;
