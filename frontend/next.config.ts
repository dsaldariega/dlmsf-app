import type { NextConfig } from "next";

// Keep Next.js defaults. Vercel already scopes the build to frontend/ and
// injects its own tracing root; overriding only Turbopack's root creates a
// mismatch between the two roots in monorepo builds.
const nextConfig: NextConfig = {};

export default nextConfig;
