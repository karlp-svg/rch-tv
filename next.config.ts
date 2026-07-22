import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't use standalone for Pages - it causes symlink issues
  output: 'export',
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  // Disable TypeScript checking during build (we do it locally)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;