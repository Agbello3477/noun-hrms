"use strict";

// client/next.config.js
var nextConfig = {
  // Enable standalone output for Docker & Kubernetes SSR deployment
  output: process.env.NEXT_EXPORT === "true" ? void 0 : "standalone",
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: "/login",
        destination: "/?login=true",
        permanent: true
      },
      {
        source: "/register",
        destination: "/?register=true",
        permanent: true
      }
    ];
  },
  async headers() {
    const cspHeader = `
            default-src 'self';
            script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com;
            style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
            font-src 'self' https://fonts.gstatic.com;
            connect-src 'self' ws://localhost:5055 wss://* http://localhost:5055 https://* http://127.0.0.1:5055;
            img-src 'self' blob: data: https://*;
            frame-src 'self';
        `.replace(/\s{2,}/g, " ").trim();
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()"
          }
        ]
      }
    ];
  }
};
module.exports = nextConfig;
