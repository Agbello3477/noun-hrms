/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "export",
    trailingSlash: false,
    images: {
        unoptimized: true
    },
    swcMinify: true,
    reactStrictMode: true,
    experimental: {
        optimizePackageImports: ['lucide-react', 'framer-motion', 'date-fns', 'recharts']
    }
};

module.exports = nextConfig;

