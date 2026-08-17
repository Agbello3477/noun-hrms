import rateLimit from 'express-rate-limit';

export const globalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    error: true,
    code: 'TOO_MANY_REQUESTS',
    message: 'Global API rate limit exceeded. Please try again after 15 minutes.'
  }
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Strict limit for authentication endpoints to prevent brute-force attacks
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: true,
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});
