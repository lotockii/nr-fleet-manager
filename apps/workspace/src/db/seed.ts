import bcrypt from 'bcryptjs';
import { db, workspaces, workspaceUsers } from './index.js';
import { count } from 'drizzle-orm';

export async function seedIfEmpty() {
  // ─── Check if already seeded ────────────────────────────────────────────────
  const [{ value }] = await db.select({ value: count() }).from(workspaceUsers);
  if (Number(value) > 0) return; // already seeded — skip

  console.log('🌱 First run detected — seeding database...');

  // ─── Admin credentials from env or defaults ──────────────────────────────
  const adminEmail    = process.env['ADMIN_EMAIL']    ?? 'admin@localhost';
  const adminPassword = process.env['ADMIN_PASSWORD'] ?? 'admin123';

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await db.insert(workspaceUsers).values({
    email: adminEmail,
    name: 'Administrator',
    passwordHash,
    role: 'super_admin',
    mustChangePassword: true,  // force password change on first login
  });

  console.log(`✅ Admin user created: ${adminEmail}`);

  // ─── Default workspaces ──────────────────────────────────────────────────
  await db.insert(workspaces).values([
    { name: 'Production',  description: 'Production environment',  color: '#ef4444' },
    { name: 'Staging',     description: 'Staging environment',     color: '#f59e0b' },
    { name: 'Development', description: 'Development environment', color: '#22c55e' },
  ]).onConflictDoNothing();

  console.log('✅ Default workspaces created');
  console.log('🎉 Seed complete!');
}
