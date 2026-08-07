import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "better-sqlite3"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
