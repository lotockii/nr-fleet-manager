import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, workspaceUsers, auditLogs } from '../db/index.js';

// Simple in-memory rate limiter for login endpoint
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /auth/login
  fastify.post<{
    Body: { email: string; password: string };
  }>(
    '/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const ip = request.ip;
      if (!checkRateLimit(ip)) {
        return reply.status(429).send({ error: 'Too many login attempts. Try again in 1 minute.' });
      }

      const { email, password } = request.body;

      const [user] = await db
        .select()
        .from(workspaceUsers)
        .where(eq(workspaceUsers.email, email))
        .limit(1);

      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return reply.status(401).send({ error: 'Unauthorized', message: 'Account is disabled' });
      }

      const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
      const token = fastify.jwt.sign(payload, { expiresIn: '8h' });

      // Update last login timestamp
      await db.update(workspaceUsers)
        .set({ lastLoginAt: new Date() })
        .where(eq(workspaceUsers.id, user.id));

      // Audit log
      await db.insert(auditLogs).values({
        action: 'auth.login',
        actor: email,
        details: { ip: request.ip },
      });

      return reply.status(200).send({
        token,
        user: payload,
        mustChangePassword: user.mustChangePassword ?? false,
      });
    },
  );

  // GET /auth/me — returns current user from JWT
  fastify.get(
    '/auth/me',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as { id: string; email: string; name: string; role: string };
      return reply.status(200).send({ id: user.id, email: user.email, name: user.name, role: user.role });
    },
  );

  // POST /auth/change-password
  fastify.post<{
    Body: { currentPassword: string; newPassword: string };
  }>(
    '/auth/change-password',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string' },
            newPassword: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const jwtUser = request.user as { id: string; email: string };
      const { currentPassword, newPassword } = request.body;

      if (!newPassword || newPassword.length < 8) {
        return reply.status(400).send({ error: 'Password must be at least 8 characters' });
      }

      const [user] = await db
        .select()
        .from(workspaceUsers)
        .where(eq(workspaceUsers.id, jwtUser.id))
        .limit(1);

      if (!user) {
        return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
      }

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: 'Unauthorized', message: 'Current password is incorrect' });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await db
        .update(workspaceUsers)
        .set({ passwordHash: newHash, mustChangePassword: false })
        .where(eq(workspaceUsers.id, jwtUser.id));

      return reply.status(200).send({ message: 'Password changed successfully' });
    },
  );
};

export default authRoutes;
