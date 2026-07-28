import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Server components externals - needed for pg and @aws-sdk
  serverExternalPackages: ['pg', 'better-sqlite3'],
  // Vercel deployment with PostgreSQL
  async headers() {
    return [
      {
        // Allow camera access even when the app is embedded in an iframe
        // (sandbox/preview environments, OBS browser sources, etc).
        // Without this the browser defaults `camera` to `self`, which blocks
        // getUserMedia inside a cross-origin iframe.
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=*, microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
