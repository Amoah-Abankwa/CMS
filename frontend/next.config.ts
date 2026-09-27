import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  transpilePackages: ['@anu/shared'],
  // The browser talks only to the web origin; Next forwards /api to NestJS.
  // Cookies are therefore first-party, and the API needs no public CORS surface.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
  poweredByHeader: false,
};

export default nextConfig;
