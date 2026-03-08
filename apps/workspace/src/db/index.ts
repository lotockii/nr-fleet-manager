import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString =
  process.env['DATABASE_URL'] ??
  (process.env['NODE_ENV'] === 'production'
    ? (() => { throw new Error('DATABASE_URL is required in production'); })()
    : 'postgresql://nr_fleet:nr_fleet_secret@localhost:5432/nr_fleet');

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

export * from './schema.js';
