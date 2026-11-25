import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Lazy database client.
 * Nothing connects (or throws) at import time, so `next build` and pages that
 * don't use the database work even when DATABASE_URL is not set. A missing
 * DATABASE_URL only surfaces when a query actually runs, where the routes and
 * the audit page already catch the error and show "storage unavailable".
 */
const globalForDb = globalThis as typeof globalThis & {
  __vortexPool?: Pool;
  __vortexDb?: NodePgDatabase;
};

function getDb(): NodePgDatabase {
  if (globalForDb.__vortexDb) return globalForDb.__vortexDb;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Add it in your environment (Netlify > Site settings > Environment variables).");
  }
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 3,
    ssl: /sslmode=require|neon\.tech|supabase\.co/.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });
  globalForDb.__vortexPool = pool;
  globalForDb.__vortexDb = drizzle(pool);
  return globalForDb.__vortexDb;
}

export const db = new Proxy({} as NodePgDatabase, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export function getPool(): Pool {
  getDb();
  return globalForDb.__vortexPool as Pool;
}
