import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(frontendRoot, "..");

const nextConfig: NextConfig = {
  // Keep monorepo output tracing for Vercel.
  outputFileTracingRoot: workspaceRoot,

  // Resolve frontend dependencies (including Tailwind) from frontend/.
  turbopack: {
    root: frontendRoot,
  },
};

export default nextConfig;
