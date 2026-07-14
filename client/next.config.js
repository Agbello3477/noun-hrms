const nextConfig = {
    output: "export",
    images: {
        unoptimized: true
    },
    webpack: (config, { dev }) => {
        if (dev) {
            config.cache = false;
        }
        return config;
    },
};

module.exports = nextConfig;
