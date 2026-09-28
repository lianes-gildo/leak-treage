import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '172.20.10.3',
    '172.20.10.*',
    '192.168.*.*',
    '10.*.*.*',
    'localhost',
    '127.0.0.1',
  ],
};

export default nextConfig;
