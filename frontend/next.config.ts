import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Keep Turbopack scoped to the frontend app. The repository also
    // contains the backend's lockfile and the root orchestration lockfile.
    root: process.cwd(),
  },
};

export default nextConfig;
