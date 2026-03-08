import type { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db, instances, instanceUsers, auditLogs } from '../db/index.js';
// import type { NRUser, NRUserRole } from '@nr-fleet/shared-types'; // reserved for future typed responses

const userRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /instances/:id/users — from DB cache
  fastify.get<{ Params: { id: string } }>(
    '/instances/:id/users',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
      if (!inst) return reply.status(404).send({ error: 'Instance not found' });

      const users = await db.select().from(instanceUsers).where(eq(instanceUsers.instanceId, id));
      const syncedAt = users[0]?.syncedAt ?? null;
      return reply.send({
        users: users.map(u => ({ username: u.username, role: u.role, permissions: u.permissions })),
        syncedAt,
      });
    },
  );

  // POST /instances/:id/users/refresh — force sync from agent
  fastify.post<{ Params: { id: string } }>(
    '/instances/:id/users/refresh',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
      if (!inst) return reply.status(404).send({ error: 'Instance not found' });
      if (inst.status !== 'online') return reply.status(400).send({ error: 'Agent offline' });

      try {
        const users = await fastify.sendCommandAndWait(id, 'get_users', {}, 10000) as any[];
        await db.delete(instanceUsers).where(eq(instanceUsers.instanceId, id));
        if (Array.isArray(users) && users.length > 0) {
          await db.insert(instanceUsers).values(users.map(u => ({
            instanceId: id,
            username: u.username ?? String(u),
            role: u.role ?? 'read-only',
            permissions: (u.permissions ?? []) as string[],
            syncedAt: new Date(),
          })));
        }
        const result = await db.select().from(instanceUsers).where(eq(instanceUsers.instanceId, id));
        return reply.send({
          users: result.map(u => ({ username: u.username, role: u.role, permissions: u.permissions })),
          syncedAt: new Date(),
        });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  // POST /instances/:id/users — create user via agent
  fastify.post<{
    Params: { id: string };
    Body: { username: string; permissions: string; password?: string; generatePassword?: boolean };
  }>(
    '/instances/:id/users',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const { username, permissions, password, generatePassword: gen } = request.body;
      const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
      if (!inst) return reply.status(404).send({ error: 'Instance not found' });
      if (inst.status !== 'online') return reply.status(400).send({ error: 'Agent offline' });

      try {
        const result = await fastify.sendCommandAndWait(id, 'nr_create_user', {
          username,
          permissions: permissions === '*' ? '*' : 'read',
          password: gen ? null : (password || null),
        }, 15000) as any;

        // Cache in DB (without password)
        await db.insert(instanceUsers).values({
          instanceId: id,
          username: result.username,
          role: result.permissions === '*' ? 'admin' : 'read-only',
          permissions: [result.permissions],
          syncedAt: new Date(),
        }).onConflictDoUpdate({
          target: [instanceUsers.instanceId, instanceUsers.username],
          set: { role: result.permissions === '*' ? 'admin' : 'read-only', syncedAt: new Date() },
        });

        const actor = (request.user as { email: string }).email;
        await db.insert(auditLogs).values({
          action: 'user.create',
          actor,
          instanceId: id,
          targetId: id,
          targetName: result.username,
          details: { username: result.username, permissions: result.permissions },
        });

        return reply.status(201).send(result); // includes plainPassword once
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  // PUT /instances/:id/users/:username — change permissions via agent
  fastify.put<{
    Params: { id: string; username: string };
    Body: { permissions: string };
  }>(
    '/instances/:id/users/:username',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id, username } = request.params;
      const { permissions } = request.body;
      const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
      if (!inst) return reply.status(404).send({ error: 'Instance not found' });
      if (inst.status !== 'online') return reply.status(400).send({ error: 'Agent offline' });

      try {
        const result = await fastify.sendCommandAndWait(id, 'nr_update_user', {
          username,
          permissions: permissions === '*' ? '*' : 'read',
        }, 15000) as any;

        await db.update(instanceUsers)
          .set({ role: permissions === '*' ? 'admin' : 'read-only', syncedAt: new Date() })
          .where(and(eq(instanceUsers.instanceId, id), eq(instanceUsers.username, username)));

        const actor = (request.user as { email: string }).email;
        await db.insert(auditLogs).values({
          action: 'user.update',
          actor,
          instanceId: id,
          targetId: id,
          targetName: username,
          details: { username, permissions },
        });

        return reply.send(result);
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  // POST /instances/:id/users/:username/reset-password
  fastify.post<{
    Params: { id: string; username: string };
    Body: { password?: string; generatePassword?: boolean };
  }>(
    '/instances/:id/users/:username/reset-password',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id, username } = request.params;
      const { password, generatePassword: gen } = request.body ?? {};
      const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
      if (!inst) return reply.status(404).send({ error: 'Instance not found' });
      if (inst.status !== 'online') return reply.status(400).send({ error: 'Agent offline' });

      try {
        const result = await fastify.sendCommandAndWait(id, 'nr_reset_password', {
          username,
          password: gen ? null : (password || null),
        }, 15000);

        const actor = (request.user as { email: string }).email;
        await db.insert(auditLogs).values({
          action: 'user.reset_password',
          actor,
          instanceId: id,
          targetId: id,
          targetName: username,
          details: { username },
        });

        return reply.send(result); // includes plainPassword once
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  // DELETE /instances/:id/users/:username
  fastify.delete<{ Params: { id: string; username: string } }>(
    '/instances/:id/users/:username',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id, username } = request.params;
      const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
      if (!inst) return reply.status(404).send({ error: 'Instance not found' });
      if (inst.status !== 'online') return reply.status(400).send({ error: 'Agent offline' });

      try {
        await fastify.sendCommandAndWait(id, 'nr_delete_user', { username }, 15000);
        await db.delete(instanceUsers).where(
          and(eq(instanceUsers.instanceId, id), eq(instanceUsers.username, username)),
        );

        const actor = (request.user as { email: string }).email;
        await db.insert(auditLogs).values({
          action: 'user.delete',
          actor,
          instanceId: id,
          targetId: id,
          targetName: username,
          details: { username },
        });

        return reply.status(200).send({ message: `User '${username}' deleted` });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    },
  );
};

export default userRoutes;
