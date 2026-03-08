import { FastifyPluginAsync } from 'fastify';
import { randomBytes, createHash } from 'crypto';
import { db, universalTokens } from '../db/index.js';
import { eq, inArray } from 'drizzle-orm';
import { getUserWorkspaceIds, getUserWorkspaceRole } from '../plugins/auth.js';

function generateToken() {
  const plaintext = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, hash };
}

const universalTokenRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /universal-tokens — returns tokenPlain from DB
  fastify.get('/universal-tokens', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = req.user;

    if (user.role === 'super_admin') {
      const tokens = await db.select({
        id: universalTokens.id,
        name: universalTokens.name,
        tokenPlain: universalTokens.tokenPlain,
        workspaceId: universalTokens.workspaceId,
        createdAt: universalTokens.createdAt,
        isActive: universalTokens.isActive,
      }).from(universalTokens);
      return reply.send(tokens);
    }

    // Non-super_admin: only tokens in accessible workspaces
    const wsIds = await getUserWorkspaceIds(user.id);
    if (wsIds.size === 0) return reply.send([]);

    const tokens = await db.select({
      id: universalTokens.id,
      name: universalTokens.name,
      tokenPlain: universalTokens.tokenPlain,
      workspaceId: universalTokens.workspaceId,
      createdAt: universalTokens.createdAt,
      isActive: universalTokens.isActive,
    }).from(universalTokens).where(inArray(universalTokens.workspaceId, Array.from(wsIds)));

    return reply.send(tokens);
  });

  // POST /universal-tokens
  fastify.post<{ Body: { name: string; workspaceId?: string } }>(
    '/universal-tokens',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const user = req.user;
      const { name, workspaceId } = req.body;

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
      const [row] = await db.insert(universalTokens).values({
        name,
        tokenHash: hash,
        tokenPlain: plaintext,
        workspaceId: workspaceId ?? null,
      }).returning();
      return reply.status(201).send({ ...row, token: plaintext, tokenVisible: true });
    },
  );

  // POST /universal-tokens/:id/regenerate — generate new token
  fastify.post<{ Params: { id: string } }>(
    '/universal-tokens/:id/regenerate',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const user = req.user;

      // Check access for non-super_admin
      if (user.role !== 'super_admin') {
        const [existing] = await db.select().from(universalTokens)
          .where(eq(universalTokens.id, req.params.id)).limit(1);
        if (!existing) return reply.status(404).send({ error: 'Not found' });
        if (!existing.workspaceId) {
          return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
        }
        const wsIds = await getUserWorkspaceIds(user.id);
        if (!wsIds.has(existing.workspaceId)) {
          return reply.status(403).send({ error: 'Forbidden', message: 'No access to this workspace' });
        }
      }

      const { plaintext, hash } = generateToken();
      const [row] = await db.update(universalTokens)
        .set({ tokenHash: hash, tokenPlain: plaintext })
        .where(eq(universalTokens.id, req.params.id))
        .returning();
      if (!row) return reply.status(404).send({ error: 'Not found' });
      return reply.send({ ...row, token: plaintext, tokenVisible: true });
    },
  );

  // DELETE /universal-tokens/:id
  fastify.delete<{ Params: { id: string } }>(
    '/universal-tokens/:id',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const user = req.user;

      if (user.role !== 'super_admin') {
        const [existing] = await db.select().from(universalTokens)
          .where(eq(universalTokens.id, req.params.id)).limit(1);
        if (!existing) return reply.status(404).send({ error: 'Not found' });
        if (!existing.workspaceId) {
          return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
        }
        const wsRole = await getUserWorkspaceRole(user.id, existing.workspaceId);
        if (wsRole !== 'workspace_admin') {
          return reply.status(403).send({ error: 'Forbidden', message: 'Only workspace_admin can delete tokens' });
        }
      }

      await db.delete(universalTokens).where(eq(universalTokens.id, req.params.id));
      return reply.status(204).send();
    },
  );
};

export default universalTokenRoutes;
