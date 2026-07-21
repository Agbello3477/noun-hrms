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
  }
};
module.exports = nextConfig;
