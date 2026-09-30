const apiUrl = process.env.API_URL ?? 'http://localhost:4011';

async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: `${apiUrl}/api/:path*`,
    },
  ];
}