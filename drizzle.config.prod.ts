import type { Config } from 'drizzle-kit';

// Production Drizzle config for Cloudflare D1.
// Reads credentials from environment for the D1 HTTP API.
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
const token = process.env.CLOUDFLARE_D1_API_TOKEN;

if (!accountId || !databaseId || !token) {
  throw new Error(
    'CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, and CLOUDFLARE_D1_API_TOKEN ' +
    'environment variables are required for production schema push.'
  );
}

export default {
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  driver: 'd1-http',
  dbCredentials: {
    accountId,
    databaseId,
    token,
  },
} satisfies Config;
