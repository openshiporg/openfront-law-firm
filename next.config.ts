import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ['law-firm.local'],
  serverExternalPackages: ['graphql'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.S3_ENDPOINT ? process.env.S3_ENDPOINT.replace(/^https?:\/\//, '').replace(/:\d+$/, '') : '/',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;