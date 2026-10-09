import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Native / Node-only packages must not be bundled by the server compiler.
  serverExternalPackages: ["pg", "nodemailer", "bcryptjs"],
  experimental: {
    serverActions: {
      // Beat/video uploads can be large files.
      bodySizeLimit: "400mb",
    },
  },
  // Audio + video are streamed from /api/file/* (supports HTTP Range requests).
  async headers() {
    return [
      {
        source: "/api/file/:path*",
        headers: [
          { key: "Accept-Ranges", value: "bytes" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
