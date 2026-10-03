import { Request, Response, NextFunction } from 'express';

// Whitelisted public / semi-static university metadata endpoints
const PUBLIC_METADATA_PATHS = [
    '/api/v1/academic/programmes',
    '/api/academic/programmes',
    '/api/org/programmes',
    '/api/v1/meta/faculties',
    '/api/meta/faculties',
    '/api/v1/meta/cadres',
    '/api/meta/cadres',
    '/api/org/structure'
];

/**
 * Layer 1: CDN & Edge Caching Header Enforcement Middleware (Cloudflare / Edge Proxy).
 * 
 * Enforces Zero-Trust Edge Security:
 * - Public semi-static catalog endpoints receive Edge-friendly directives:
 *   Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400
 * - All authenticated, sensitive, and transactional routes strictly enforce:
 *   Cache-Control: no-store, no-cache, private, must-revalidate
 *   Pragma: no-cache
 *   Surrogate-Control: no-store
 */
export const edgeCacheControlMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const path = req.path.toLowerCase();

    // Check if this is a semi-static public catalog endpoint
    const isPublicMetadata = PUBLIC_METADATA_PATHS.some(p => path === p || path.endsWith(p));

    if (isPublicMetadata && req.method === 'GET') {
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        res.setHeader('Vary', 'Accept-Encoding');
    } else if (path.startsWith('/api') || path.startsWith('/api/v1')) {
        // Zero-Trust default for all authenticated & transactional API routes:
        // Strictly prevent edge proxies from caching private session data
        res.setHeader('Cache-Control', 'no-store, no-cache, private, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Surrogate-Control', 'no-store');
        res.setHeader('Expires', '0');
    }

    next();
};
