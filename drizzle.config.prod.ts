import type { Config } from 'drizzle-kit';

// Production Drizzle config — reads DATABASE_URL from the environment.
// Used by the deployment batch scripts:  npx drizzle-kit push --config=drizzle.config.prod.ts
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL environment variable is required for the production schema push.');
}

export default {
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  dbCredentials: { url },
} satisfies Config;
