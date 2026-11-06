import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // The repository is a monorepo: keep Turbopack's workspace root aligned
    // with Vercel's output tracing root (the repository root).
    root: path.resolve(process.cwd(), ".."),
  },
};

export default nextConfig;
