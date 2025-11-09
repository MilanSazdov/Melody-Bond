import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence multiple lockfile root selection warning by pinning turbopack root
  turbopack: {
    root: __dirname,
  },
  // Enable strict React and typed routes defaults
  reactStrictMode: true,
};

export default nextConfig;
