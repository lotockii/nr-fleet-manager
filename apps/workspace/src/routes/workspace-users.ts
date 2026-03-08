import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, workspaceUsers } from '../db/index.js';

interface JwtUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

const workspaceUsersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate);

  async function requireSuperAdmin(
    request: Parameters<typeof fastify.authenticate>[0],
    reply: Parameters<typeof fastify.authenticate>[1],
  ) {
    const user = request.user as JwtUser;
    if (user.role !== 'super_admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Requires super_admin role' });
    }
  }

  // GET /workspace-users
  fastify.get('/workspace-users', { preHandler: [requireSuperAdmin] }, async (_request, reply) => {
    const users = await db
      .select({
        id: workspaceUsers.id,
        email: workspaceUsers.email,
        name: workspaceUsers.name,
        role: workspaceUsers.role,
        isActive: workspaceUsers.isActive,
        lastLoginAt: workspaceUsers.lastLoginAt,
        createdAt: workspaceUsers.createdAt,
      })
      .from(workspaceUsers);

    return reply.status(200).send(users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    })));
  });

  // POST /workspace-users
  fastify.post<{
    Body: { email: string; name: string; role: 'super_admin' | 'operator' | 'viewer'; password: string; isActive?: boolean };
  }>(
    '/workspace-users',
    {
      preHandler: [requireSuperAdmin],
      schema: {
        body: {
          type: 'object',
          required: ['email', 'name', 'role', 'password'],
          properties: {
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['super_admin', 'operator', 'viewer'] },
            password: { type: 'string' },
            isActive: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, name, role, password, isActive = true } = request.body;

      if (!password || password.length < 8) {
        return reply.status(400).send({ error: 'Password must be at least 8 characters' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const [user] = await db
        .insert(workspaceUsers)
        .values({ email, name, role, passwordHash, isActive })
        .returning();

      return reply.status(201).send({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      });
    },
  );

  // PUT /workspace-users/:id
  fastify.put<{
    Params: { id: string };
    Body: { name?: string; role?: 'super_admin' | 'operator' | 'viewer'; isActive?: boolean };
  }>(
    '/workspace-users/:id',
    {
      preHandler: [requireSuperAdmin],
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            role: { type: 'string', enum: ['super_admin', 'operator', 'viewer'] },
            isActive: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { name, role, isActive } = request.body;
      const patch: Partial<typeof workspaceUsers.$inferInsert> = { updatedAt: new Date() };
      if (name !== undefined) patch.name = name;
      if (role !== undefined) patch.role = role;
      if (isActive !== undefined) patch.isActive = isActive;

      const [user] = await db.update(workspaceUsers).set(patch).where(eq(workspaceUsers.id, id)).returning();
      if (!user) return reply.status(404).send({ error: 'Not Found', message: 'User not found' });

      return reply.status(200).send({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      });
    },
  );

  // DELETE /workspace-users/:id
  fastify.delete<{ Params: { id: string } }>(
    '/workspace-users/:id',
    {
      preHandler: [requireSuperAdmin],
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const currentUser = request.user as JwtUser;

      if (currentUser.id === id) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Cannot delete your own account' });
      }

      const [deleted] = await db.delete(workspaceUsers).where(eq(workspaceUsers.id, id)).returning();
      if (!deleted) return reply.status(404).send({ error: 'Not Found', message: 'User not found' });

      return reply.status(204).send();
    },
  );
};

export default workspaceUsersRoutes;
