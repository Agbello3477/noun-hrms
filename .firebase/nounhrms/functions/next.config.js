"use strict";

// next.config.js
var nextConfig = {
  output: "standalone",
  swcMinify: true,
  compress: true,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "date-fns", "recharts"]
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5055";
    return [
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`
      },
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`
      }
    ];
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800"
          }
        ]
      }
    ];
  }
};
module.exports = nextConfig;
