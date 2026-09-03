import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  eslint: {
    // CI runs `npm run lint` as its own step; keep `next build` focused on compiling.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
