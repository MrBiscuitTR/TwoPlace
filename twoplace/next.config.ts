import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // disable turbo
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'twoplace.cagann.dev',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
