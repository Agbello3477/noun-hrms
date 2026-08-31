import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Optimizes the PostgreSQL / Neon database connection URL with recommended
 * PgBouncer transaction pooling, TCP keepalive, and timeout parameters.
 */
export function buildOptimizedDatabaseUrl(rawUrl?: string): string {
  const urlString = rawUrl || process.env.DATABASE_URL || '';
  if (!urlString || urlString.startsWith('file:') || urlString.startsWith('sqlite:')) {
    return urlString;
  }

  try {
    const parsed = new URL(urlString);

    // Detect Neon or pooled Postgres instances
    const isNeonOrPooler =
      parsed.hostname.includes('neon.tech') ||
      parsed.hostname.includes('-pooler') ||
      parsed.port === '6543' ||
      urlString.includes('pgbouncer=true') ||
      process.env.ENABLE_PGBOUNCER === 'true';

    // 1. Neon PgBouncer Transaction Mode (Eliminates prepared statement conflicts)
    if (isNeonOrPooler && !parsed.searchParams.has('pgbouncer')) {
      parsed.searchParams.set('pgbouncer', 'true');
    }

    // 2. Connection Pool Allocation (Prevent serverless connection exhaustion)
    if (!parsed.searchParams.has('connection_limit')) {
      const connLimit = process.env.DATABASE_CONNECTION_LIMIT || (isNeonOrPooler ? '20' : '10');
      parsed.searchParams.set('connection_limit', connLimit);
    }

    // 3. Pool & Connection Timeouts for Serverless Cold-Start Resilience
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', '30'); // 30s pool acquisition timeout
    }
    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', '15'); // 15s initial TCP connect timeout
    }

    // 4. SSL Encryption for Cloud Managed Postgres
    if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      if (!parsed.searchParams.has('sslmode')) {
        parsed.searchParams.set('sslmode', 'require');
      }
    }

    return parsed.toString();
  } catch (err) {
    console.warn('[Prisma Init] Warning parsing DATABASE_URL:', err);
    return urlString;
  }
}

// Transient error codes that warrant automatic retry with backoff (e.g. Neon compute cold start)
const RETRYABLE_PRISMA_ERRORS = new Set([
  'P1001', // Can't reach database server
  'P1002', // The database server was reached but timed out
  'P1008', // Operations timed out
  'P1017', // Server has closed the connection
  'P2024', // Timed out fetching a new connection from the pool
  '57P01', // admin_shutdown / terminating connection
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT'
]);

/**
 * Creates a resilient Prisma client with automatic exponential backoff retry
 * for transient network / cold-start drops between Render and Neon.
 */
function createPrismaClient(): PrismaClient {
  const optimizedUrl = buildOptimizedDatabaseUrl();

  const baseClient = new PrismaClient({
    datasources: {
      db: {
        url: optimizedUrl
      }
    },
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error']
  });

  // Attach resilient retry extension for serverless compute resiliency
  const extendedClient = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const maxRetries = 2;
          let attempt = 0;
          let delayMs = 150;

          while (true) {
            try {
              return await query(args);
            } catch (error: any) {
              attempt++;
              const errorCode = error?.code || error?.name || '';
              const isRetryable =
                RETRYABLE_PRISMA_ERRORS.has(errorCode) ||
                (error?.message && error.message.includes('Can\'t reach database server')) ||
                (error?.message && error.message.includes('Connection closed before message completed'));

              if (isRetryable && attempt <= maxRetries) {
                const jitter = Math.random() * 50;
                console.warn(
                  `[Prisma Retry] Transient DB error (${errorCode}) on ${String(model)}.${operation}. Retrying attempt ${attempt}/${maxRetries} in ${Math.round(delayMs + jitter)}ms...`
                );
                await new Promise((res) => setTimeout(res, delayMs + jitter));
                delayMs *= 2.5; // Exponential backoff
                continue;
              }

              throw error;
            }
          }
        }
      }
    }
  });

  return extendedClient as unknown as PrismaClient;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
