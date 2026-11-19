import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    cpus: 2,
    memoryBasedWorkersCount: true,
  },
};

export default nextConfig;
