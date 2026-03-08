import type { FastifyPluginAsync } from 'fastify';
import { eq, and, gte, lte, desc, count as sqlCount } from 'drizzle-orm';
import { db, auditLogs } from '../db/index.js';

interface AuditLogsQuerystring {
  instanceId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: string;
  page?: string;
  offset?: string;
}

const auditRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: AuditLogsQuerystring }>(
    '/audit-logs',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { instanceId, action, from, to, limit: limitStr, page: pageStr, offset: offsetStr } = request.query;

      const limit = limitStr !== undefined ? Math.min(parseInt(limitStr, 10) || 50, 200) : 50;
      const page = pageStr !== undefined ? Math.max(parseInt(pageStr, 10) || 1, 1) : 1;
      const offset = offsetStr !== undefined ? parseInt(offsetStr, 10) || 0 : (page - 1) * limit;

      // Build conditions
      const conditions = [];
      if (instanceId) conditions.push(eq(auditLogs.instanceId, instanceId));
      if (action) conditions.push(eq(auditLogs.action, action));
      if (from) conditions.push(gte(auditLogs.createdAt, new Date(from)));
      if (to) conditions.push(lte(auditLogs.createdAt, new Date(to)));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // SQL COUNT — no in-memory loading
      const [{ total }] = await db
        .select({ total: sqlCount() })
        .from(auditLogs)
        .where(whereClause);

      const data = await db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return reply.status(200).send({
        data: data.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
        total,
        page,
        limit,
        offset,
      });
    },
  );
};

export default auditRoutes;
