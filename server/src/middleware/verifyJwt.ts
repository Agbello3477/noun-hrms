import { verifyToken } from './auth.middleware';

/**
 * JWT verification middleware alias for standard route declarations.
 */
export const verifyJwt = verifyToken;
export default verifyJwt;
