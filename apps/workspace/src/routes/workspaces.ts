import type { FastifyPluginAsync } from 'fastify';
import { eq, and, inArray } from 'drizzle-orm';
import { db, workspaces, instances, workspaceAccess, workspaceUsers } from '../db/index.js';
import { getUserWorkspaceIds } from '../plugins/auth.js';

const workspaceRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /workspaces
  fastify.get('/workspaces', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user;

    if (user.role === 'super_admin') {
      const rows = await db.select().from(workspaces);
      return reply.status(200).send(rows.map((w) => ({ ...w, createdAt: w.createdAt.toISOString() })));
    }

    // Non-super_admin: only workspaces with access
    const wsIds = await getUserWorkspaceIds(user.id);
    if (wsIds.size === 0) return reply.status(200).send([]);

    const rows = await db.select().from(workspaces).where(inArray(workspaces.id, Array.from(wsIds)));
    return reply.status(200).send(rows.map((w) => ({ ...w, createdAt: w.createdAt.toISOString() })));
  });

  // GET /workspaces/:id
  fastify.get<{ Params: { id: string } }>(
    '/workspaces/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, request.params.id)).limit(1);
      if (!ws) return reply.status(404).send({ error: 'Not Found', message: 'Workspace not found' });
      return reply.status(200).send({ ...ws, createdAt: ws.createdAt.toISOString() });
    },
  );

  // POST /workspaces
  fastify.post<{ Body: { name: string; description?: string; color: string } }>(
    '/workspaces',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['name', 'color'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            color: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { role?: string };
      if (user.role !== 'super_admin') {
        return reply.status(403).send({ error: 'Forbidden', message: 'Only super_admin can create workspaces' });
      }
      const [ws] = await db.insert(workspaces).values(request.body).returning();
      return reply.status(201).send({ ...ws, createdAt: ws.createdAt.toISOString() });
    },
  );

  // PUT /workspaces/:id
  fastify.put<{ Params: { id: string }; Body: { name?: string; description?: string; color?: string } }>(
    '/workspaces/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            color: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { name, description, color } = request.body;
      const patch: Partial<typeof workspaces.$inferInsert> = { updatedAt: new Date() };
      if (name !== undefined) patch.name = name;
      if (description !== undefined) patch.description = description;
      if (color !== undefined) patch.color = color;

      const [ws] = await db.update(workspaces).set(patch).where(eq(workspaces.id, id)).returning();
      if (!ws) return reply.status(404).send({ error: 'Not Found', message: 'Workspace not found' });
      return reply.status(200).send({ ...ws, createdAt: ws.createdAt.toISOString() });
    },
  );

  // DELETE /workspaces/:id
  fastify.delete<{ Params: { id: string } }>(
    '/workspaces/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const instanceCount = await db
        .select()
        .from(instances)
        .where(eq(instances.workspaceId, id));

      if (instanceCount.length > 0) {
        return reply.status(409).send({
          error: 'Conflict',
          message: `Cannot delete workspace: it has ${instanceCount.length} instance(s). Move or delete them first.`,
        });
      }

      const [deleted] = await db.delete(workspaces).where(eq(workspaces.id, id)).returning();
      if (!deleted) return reply.status(404).send({ error: 'Not Found', message: 'Workspace not found' });
      return reply.status(204).send();
    },
  );

  // ─── Workspace Access Control ─────────────────────────────────────────────

  async function canManageAccess(user: { id: string; role?: string }, workspaceId: string): Promise<boolean> {
    if (user.role === 'super_admin') return true;
    const [entry] = await db
      .select()
      .from(workspaceAccess)
      .where(and(eq(workspaceAccess.userId, user.id), eq(workspaceAccess.workspaceId, workspaceId)))
      .limit(1);
    return entry?.role === 'workspace_admin';
  }

  // GET /workspaces/:id/access
  fastify.get<{ Params: { id: string } }>(
    '/workspaces/:id/access',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user as { id: string; role?: string };
      if (!(await canManageAccess(user, id))) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Insufficient permissions' });
      }
      const entries = await db
        .select({
          id: workspaceAccess.id,
          workspaceId: workspaceAccess.workspaceId,
          userId: workspaceAccess.userId,
          role: workspaceAccess.role,
          grantedAt: workspaceAccess.grantedAt,
          userEmail: workspaceUsers.email,
          userName: workspaceUsers.name,
        })
        .from(workspaceAccess)
        .leftJoin(workspaceUsers, eq(workspaceAccess.userId, workspaceUsers.id))
        .where(eq(workspaceAccess.workspaceId, id));

      return reply.status(200).send(entries.map((e) => ({ ...e, grantedAt: e.grantedAt.toISOString() })));
    },
  );

  // POST /workspaces/:id/access
  fastify.post<{ Params: { id: string }; Body: { userId: string; role: string } }>(
    '/workspaces/:id/access',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'role'],
          properties: {
            userId: { type: 'string' },
            role: { type: 'string', enum: ['workspace_admin', 'workspace_operator', 'workspace_viewer'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user as { id: string; role?: string };
      if (!(await canManageAccess(user, id))) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Insufficient permissions' });
      }
      const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
      if (!ws) return reply.status(404).send({ error: 'Not Found', message: 'Workspace not found' });

      const existing = await db
        .select()
        .from(workspaceAccess)
        .where(and(eq(workspaceAccess.workspaceId, id), eq(workspaceAccess.userId, request.body.userId)))
        .limit(1);

      if (existing.length > 0) {
        return reply.status(409).send({ error: 'Conflict', message: 'User already has access to this workspace' });
      }

      const [entry] = await db
        .insert(workspaceAccess)
        .values({
          workspaceId: id,
          userId: request.body.userId,
          role: request.body.role as 'workspace_admin' | 'workspace_operator' | 'workspace_viewer',
        })
        .returning();

      return reply.status(201).send({ ...entry, grantedAt: entry.grantedAt.toISOString() });
    },
  );

  // PUT /workspaces/:id/access/:accessId
  fastify.put<{ Params: { id: string; accessId: string }; Body: { role: string } }>(
    '/workspaces/:id/access/:accessId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['role'],
          properties: {
            role: { type: 'string', enum: ['workspace_admin', 'workspace_operator', 'workspace_viewer'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { id, accessId } = request.params;
      const user = request.user as { id: string; role?: string };
      if (!(await canManageAccess(user, id))) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Insufficient permissions' });
      }
      const [updated] = await db
        .update(workspaceAccess)
        .set({ role: request.body.role as 'workspace_admin' | 'workspace_operator' | 'workspace_viewer' })
        .where(eq(workspaceAccess.id, accessId))
        .returning();

      if (!updated) return reply.status(404).send({ error: 'Not Found', message: 'Access record not found' });
      return reply.status(200).send({ ...updated, grantedAt: updated.grantedAt.toISOString() });
    },
  );

  // DELETE /workspaces/:id/access/:accessId
  fastify.delete<{ Params: { id: string; accessId: string } }>(
    '/workspaces/:id/access/:accessId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id, accessId } = request.params;
      const user = request.user as { id: string; role?: string };
      if (!(await canManageAccess(user, id))) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Insufficient permissions' });
      }
      const [deleted] = await db.delete(workspaceAccess).where(eq(workspaceAccess.id, accessId)).returning();
      if (!deleted) return reply.status(404).send({ error: 'Not Found', message: 'Access record not found' });
      return reply.status(204).send();
    },
  );

  // GET /workspaces/:id/available-users
  fastify.get<{ Params: { id: string } }>(
    '/workspaces/:id/available-users',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const user = request.user as { id: string; role?: string };
      if (!(await canManageAccess(user, id))) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Insufficient permissions' });
      }

      // Get existing access user IDs
      const existingAccess = await db
        .select({ userId: workspaceAccess.userId })
        .from(workspaceAccess)
        .where(eq(workspaceAccess.workspaceId, id));

      const existingIds = new Set(existingAccess.map((a) => a.userId));

      const allUsers = await db
        .select({ id: workspaceUsers.id, email: workspaceUsers.email, name: workspaceUsers.name, role: workspaceUsers.role, createdAt: workspaceUsers.createdAt })
        .from(workspaceUsers);

      const available = allUsers
        .filter((u) => !existingIds.has(u.id))
        .map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));

      return reply.status(200).send(available);
    },
  );
};

export default workspaceRoutes;
