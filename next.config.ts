import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Enables forbidden() → app/forbidden.tsx for server-side authorisation failures.
  experimental: { authInterrupts: true },
};

export default nextConfig;
