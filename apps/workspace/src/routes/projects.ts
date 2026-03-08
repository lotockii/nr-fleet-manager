import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, instances, instanceProjects } from '../db/index.js';

const projectRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /instances/:id/projects — from DB cache
  fastify.get<{ Params: { id: string } }>(
    '/instances/:id/projects',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
      if (!inst) return reply.status(404).send({ error: 'Instance not found' });

      const projects = await db.select().from(instanceProjects).where(eq(instanceProjects.instanceId, id));
      const syncedAt = projects[0]?.syncedAt ?? null;
      return reply.send({
        projects: projects.map(p => ({
          name: p.name,
          hasGit: p.hasGit,
          branch: p.branch,
          remote: p.remoteUrl,
          lastCommit: p.lastCommitHash
            ? { hash: p.lastCommitHash, message: p.lastCommitMessage, date: p.lastCommitDate }
            : null,
          isDirty: p.isDirty,
        })),
        syncedAt,
      });
    },
  );

  // POST /instances/:id/projects/refresh — force sync from agent
  fastify.post<{ Params: { id: string } }>(
    '/instances/:id/projects/refresh',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
      if (!inst) return reply.status(404).send({ error: 'Instance not found' });
      if (inst.status !== 'online') return reply.status(400).send({ error: 'Agent offline' });

      try {
        const projects = await fastify.sendCommandAndWait(id, 'get_projects', {}, 15000) as any[];
        await db.delete(instanceProjects).where(eq(instanceProjects.instanceId, id));
        if (Array.isArray(projects) && projects.length > 0) {
          await db.insert(instanceProjects).values(projects.map(p => ({
            instanceId: id,
            name: p.name,
            hasGit: p.hasGit ?? false,
            branch: p.branch ?? null,
            remoteUrl: p.remote ?? null,
            lastCommitHash: p.lastCommit?.hash ?? null,
            lastCommitMessage: p.lastCommit?.message ?? null,
            lastCommitDate: p.lastCommit?.date ?? null,
            isDirty: p.isDirty ?? false,
            syncedAt: new Date(),
          })));
        }
        const result = await db.select().from(instanceProjects).where(eq(instanceProjects.instanceId, id));
        return reply.send({
          projects: result.map(p => ({
            name: p.name,
            hasGit: p.hasGit,
            branch: p.branch,
            remote: p.remoteUrl,
            lastCommit: p.lastCommitHash
              ? { hash: p.lastCommitHash, message: p.lastCommitMessage, date: p.lastCommitDate }
              : null,
            isDirty: p.isDirty,
          })),
          syncedAt: new Date(),
        });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    },
  );
  // GET /instances/:id/projects/:name/branches
  fastify.get<{ Params: { id: string; name: string } }>(
    '/instances/:id/projects/:name/branches',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id, name } = request.params;
      const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
      if (!inst) return reply.status(404).send({ error: 'Instance not found' });
      if (inst.status !== 'online') return reply.status(400).send({ error: 'Agent offline' });
      try {
        const result = await fastify.sendCommandAndWait(id, 'get_branches', { projectName: name }, 20000);
        return reply.send(result);
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  // POST /instances/:id/projects/:name/pull
  fastify.post<{ Params: { id: string; name: string }; Body: { branch?: string } }>(
    '/instances/:id/projects/:name/pull',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id, name } = request.params;
      const { branch } = request.body ?? {};
      const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
      if (!inst) return reply.status(404).send({ error: 'Instance not found' });
      if (inst.status !== 'online') return reply.status(400).send({ error: 'Agent offline' });
      try {
        const result = await fastify.sendCommandAndWait(id, 'git_pull', { projectName: name, branch }, 30000);
        // Refresh project cache after pull
        try {
          const projects = await fastify.sendCommandAndWait(id, 'get_projects', {}, 15000) as any[];
          if (Array.isArray(projects)) {
            await db.delete(instanceProjects).where(eq(instanceProjects.instanceId, id));
            if (projects.length > 0) {
              await db.insert(instanceProjects).values(projects.map(p => ({
                instanceId: id,
                name: p.name,
                hasGit: p.hasGit ?? false,
                branch: p.branch ?? null,
                remoteUrl: p.remote ?? null,
                lastCommitHash: p.lastCommit?.hash ?? null,
                lastCommitMessage: p.lastCommit?.message ?? null,
                lastCommitDate: p.lastCommit?.date ?? null,
                isDirty: p.isDirty ?? false,
                syncedAt: new Date(),
              })));
            }
          }
        } catch { /* ignore cache refresh errors */ }
        return reply.send(result);
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  // POST /instances/:id/projects/:name/rollback
  fastify.post<{ Params: { id: string; name: string }; Body: { commitHash: string } }>(
    '/instances/:id/projects/:name/rollback',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id, name } = request.params;
      const { commitHash } = request.body;
      const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
      if (!inst) return reply.status(404).send({ error: 'Instance not found' });
      if (inst.status !== 'online') return reply.status(400).send({ error: 'Agent offline' });
      try {
        const result = await fastify.sendCommandAndWait(id, 'git_rollback', { projectName: name, commitHash }, 30000);
        return reply.send(result);
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    },
  );
  // POST /instances/:id/projects/:name/push
  fastify.post<{ Params: { id: string; name: string }; Body: { localBranch: string; remoteBranch?: string } }>(
    '/instances/:id/projects/:name/push',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id, name } = request.params;
      const { localBranch, remoteBranch } = request.body;
      if (!localBranch) return reply.status(400).send({ error: 'localBranch is required' });

      const [inst] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
      if (!inst) return reply.status(404).send({ error: 'Instance not found' });
      if (inst.status !== 'online') return reply.status(400).send({ error: 'Agent offline' });

      try {
        const result = await fastify.sendCommandAndWait(id, 'git_push', {
          projectName: name,
          localBranch,
          remoteBranch: remoteBranch || localBranch,
        }, 35000);
        return reply.send(result);
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    },
  );
};

export default projectRoutes;
