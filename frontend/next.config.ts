import type { NextConfig } from 'next';
import { securityHeaders } from './security-headers.mjs';

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  transpilePackages: ['@anu/shared'],

  // The browser talks only to the web origin; Next forwards /api to NestJS.
  // Cookies are therefore first-party, and the API needs no public CORS surface.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },

  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders(process.env.NODE_ENV === 'production'),
      },
    ];
  },
};

export default nextConfig;