import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db, workspaceAccess } from '../db/index.js';

// ─── Type Augmentation ────────────────────────────────────────────────────────

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string; name: string; role: string };
    user: { id: string; email: string; name: string; role: string };
  }
}

// ─── RBAC Helpers ─────────────────────────────────────────────────────────────

/**
 * Returns a Set of workspaceIds the given user has access to via workspace_access table.
 */
export async function getUserWorkspaceIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ workspaceId: workspaceAccess.workspaceId })
    .from(workspaceAccess)
    .where(eq(workspaceAccess.userId, userId));
  return new Set(rows.map((r) => r.workspaceId));
}

/**
 * Returns the workspace_access role for a specific user+workspace, or null if no access.
 */
export async function getUserWorkspaceRole(userId: string, workspaceId: string): Promise<string | null> {
  const [result] = await db
    .select({ role: workspaceAccess.role })
    .from(workspaceAccess)
    .where(and(eq(workspaceAccess.userId, userId), eq(workspaceAccess.workspaceId, workspaceId)))
    .limit(1);
  return result?.role ?? null;
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch (_err) {
        reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
      }
    },
  );
};

export default fp(authPlugin, { name: 'auth-plugin' });
