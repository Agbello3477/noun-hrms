"use strict";

// client/next.config.js
var nextConfig = {
  output: process.env.NEXT_STANDALONE === "true" ? "standalone" : void 0,
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
