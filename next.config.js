/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Turbopack (default in Next.js 16)
  turbopack: {},

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Server-only packages (pdf-parse uses Node.js fs)
  serverExternalPackages: ['pdf-parse'],
};

module.exports = nextConfig;
