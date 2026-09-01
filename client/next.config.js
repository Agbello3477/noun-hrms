/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    swcMinify: true,
    compress: true,
    reactStrictMode: true,
    experimental: {
        optimizePackageImports: ['lucide-react', 'framer-motion', 'date-fns', 'recharts']
    },
    async headers() {
        return [
            {
                source: '/_next/static/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable'
                    }
                ]
            },
            {
                source: '/images/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=86400, stale-while-revalidate=604800'
                    }
                ]
            }
        ];
    }
};

module.exports = nextConfig;

