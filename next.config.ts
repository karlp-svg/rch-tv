import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // D1 / SQLite doesn't need any special server externals
};

export default nextConfig;
