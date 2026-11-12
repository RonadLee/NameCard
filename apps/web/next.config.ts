import type { NextConfig } from "next";

const config: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    const api = process.env.API_ORIGIN ?? "http://127.0.0.1:4000";
    return [{ source: "/api/:path*", destination: `${api}/:path*` }];
  },
  images: { unoptimized: true },
};

export default config;
