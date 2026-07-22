import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

// Only validate at runtime, not build time
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required in production');
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

// Lightweight, idempotent compatibility migration for production databases.
// This keeps a deployed Supabase schema usable when a newer app release adds
// fields such as queue state or the "Anything by artist" song option.
let compatibilityPromise: Promise<void> | null = null;

export function ensureDatabaseCompatibility() {
  if (compatibilityPromise) return compatibilityPromise;

  compatibilityPromise = (async () => {
    // PostgreSQL enum changes must be issued independently from table changes.
    await pool.query("ALTER TYPE status ADD VALUE IF NOT EXISTS 'queued';");

    await pool.query("ALTER TABLE song_requests ADD COLUMN IF NOT EXISTS any_title boolean NOT NULL DEFAULT false;");
    await pool.query("ALTER TABLE song_requests ALTER COLUMN title DROP NOT NULL;");

    await pool.query("ALTER TABLE fame_submissions ADD COLUMN IF NOT EXISTS image_url text;");
    await pool.query("ALTER TABLE fame_submissions ADD COLUMN IF NOT EXISTS polaroid_url text;");
    await pool.query("ALTER TABLE fame_submissions ADD COLUMN IF NOT EXISTS polaroid_base64 text;");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS social_posts (
        id serial PRIMARY KEY,
        post_type varchar(20) NOT NULL,
        image_base64 text,
        image_url text,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
  })().catch((error) => {
    // Clear the promise so a later request can retry after a transient DB failure.
    compatibilityPromise = null;
    console.error('Database compatibility migration failed:', error);
    throw error;
  });

  return compatibilityPromise;
}

// Start the safe migration early, while API handlers below explicitly await it.
ensureDatabaseCompatibility().catch(() => {});
