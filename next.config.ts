import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Server components externals - needed for pg and @aws-sdk
  serverExternalPackages: ['pg', 'better-sqlite3'],
  // Vercel deployment with PostgreSQL
};

export default nextConfig;
