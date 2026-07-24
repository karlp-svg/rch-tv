import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
// Re-export the PostgreSQL schema as the default schema
export * from "./schema.pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __rchtvPgPool?: Pool;
};

export const pool =
  globalForDb.__rchtvPgPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl:
      databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__rchtvPgPool = pool;
}

export const db = drizzle(pool, { schema: require("./schema.pg") });
