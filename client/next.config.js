/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    swcMinify: true,
    compress: true,
    reactStrictMode: true,
    experimental: {
        optimizePackageImports: ['lucide-react', 'framer-motion', 'date-fns']
    }
};

module.exports = nextConfig;
