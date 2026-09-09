import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Served at bold.30x.com/pulso via the same load balancer as Bold (path
  // matcher on bold-lb), embedded there in an iframe — same origin, so no
  // CSP frame-ancestors or third-party-cookie IAP session issues.
  basePath: "/pulso",
};

export default nextConfig;
