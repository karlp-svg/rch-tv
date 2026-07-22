import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Create standalone output for Cloudflare compatibility
  output: 'standalone',
  // Disable static image optimization (not needed for Cloudflare)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;