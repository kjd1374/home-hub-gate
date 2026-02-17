import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  /* config options here */
  async rewrites() {
    return [
      {
        source: '/tv/',
        destination: 'http://127.0.0.1:8501/tv/',
      },
      {
        source: '/tv/:path*',
        destination: 'http://127.0.0.1:8501/tv/:path*',
      },
    ]
  },
};

export default nextConfig;
