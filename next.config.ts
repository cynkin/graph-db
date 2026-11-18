import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build for the Docker image (see Dockerfile).
  output: "standalone",
  // Load these from node_modules at runtime instead of bundling them, so they are also
  // available to scripts/seed.mjs inside the Docker image.
  serverExternalPackages: ["better-sqlite3", "neo4j-driver", "bcryptjs"],
};

export default nextConfig;
