import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ["192.168.11.145"],
};

export default nextConfig;
