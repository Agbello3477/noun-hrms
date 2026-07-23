"use strict";

// client/next.config.js
var nextConfig = {
  output: "standalone",
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  }
};
module.exports = nextConfig;
