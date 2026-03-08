import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './db/index.js';
import { seedIfEmpty } from './db/seed.js';
import { buildApp } from './app.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env['PORT'] ?? 3001);
const HOST = process.env['HOST'] ?? '0.0.0.0';

async function main() {
  // 1. Run DB migrations
  console.log('🔄 Running database migrations...');
  try {
    await migrate(db, { migrationsFolder: join(__dirname, '../drizzle') });
    console.log('✅ Migrations complete');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }

  // 2. Seed on first run
  try {
    await seedIfEmpty();
  } catch (err) {
    console.error('❌ Database seed failed:', err);
    process.exit(1);
  }

  // 3. Start server
  const app = await buildApp();
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Backend running at http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
