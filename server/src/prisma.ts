import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Optimizes the PostgreSQL / Supabase / Neon database connection URL with recommended
 * PgBouncer transaction pooling, statement cache disabling, connection limits, and timeout parameters.
 */
export function buildOptimizedDatabaseUrl(rawUrl?: string): string {
  let urlString = (rawUrl || process.env.DATABASE_URL || '').trim();

  // Strip accidental surrounding quotes ("..." or '...')
  if ((urlString.startsWith('"') && urlString.endsWith('"')) || (urlString.startsWith("'") && urlString.endsWith("'"))) {
    urlString = urlString.slice(1, -1).trim();
  }

  // Strip accidental variable name prefix (e.g. DATABASE_URL=... or DIRECT_URL=...)
  if (urlString.startsWith('DATABASE_URL=')) {
    urlString = urlString.replace(/^DATABASE_URL=/, '').trim();
  }
  if (urlString.startsWith('DIRECT_URL=')) {
    urlString = urlString.replace(/^DIRECT_URL=/, '').trim();
  }

  if (!urlString || urlString.startsWith('file:') || urlString.startsWith('sqlite:')) {
    return urlString;
  }

  try {
    const parsed = new URL(urlString);

    // Detect Supabase, Neon, PgBouncer, or pooled Postgres instances
    const isPooler =
      parsed.hostname.includes('supabase.com') ||
      parsed.hostname.includes('supabase.co') ||
      parsed.hostname.includes('pooler') ||
      parsed.hostname.includes('neon.tech') ||
      parsed.port === '6543' ||
      urlString.includes('pgbouncer=true') ||
      process.env.ENABLE_PGBOUNCER === 'true';

    // 1. PgBouncer / Supavisor Transaction Mode
    if (isPooler || parsed.port === '6543') {
      if (!parsed.searchParams.has('pgbouncer')) {
        parsed.searchParams.set('pgbouncer', 'true');
      }
      // Disable prepared statement caching on transaction poolers to avoid collisions
      if (!parsed.searchParams.has('statement_cache_size')) {
        parsed.searchParams.set('statement_cache_size', '0');
      }
    }

    // 2. Connection Pool Allocation (Prevent serverless & cloud connection pool exhaustion)
    if (!parsed.searchParams.has('connection_limit')) {
      const connLimit = process.env.DATABASE_CONNECTION_LIMIT || (isPooler ? '15' : '10');
      parsed.searchParams.set('connection_limit', connLimit);
    }

    // 3. Pool & Connection Timeouts for Cloud Network Resilience
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', '30'); // 30s pool acquisition timeout
    }
    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', '20'); // 20s initial TCP connect timeout
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

// Transient error codes that warrant automatic retry with backoff
const RETRYABLE_PRISMA_ERRORS = new Set([
  'P1000', // Authentication failed against database server
  'P1001', // Can't reach database server
  'P1002', // The database server was reached but timed out
  'P1008', // Operations timed out
  'P1011', // Error opening a TLS connection
  'P1017', // Server has closed the connection
  'P2024', // Timed out fetching a new connection from the pool
  '57P01', // admin_shutdown / terminating connection
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  'XX000', // Internal PgBouncer / proxy error
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT'
]);

function isRetryableError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || error.name || '');
  if (RETRYABLE_PRISMA_ERRORS.has(code)) return true;

  const msg = String(error.message || '').toLowerCase();
  return (
    msg.includes("can't reach database server") ||
    msg.includes('connection closed before message completed') ||
    msg.includes('server has closed the connection') ||
    msg.includes('connection terminated unexpectedly') ||
    msg.includes('query_wait_timeout') ||
    msg.includes('client was closed and is not able to process query') ||
    msg.includes('socket has been ended by the other party') ||
    msg.includes('prepared statement')
  );
}

/**
 * Creates a stabilized Prisma client with automatic exponential backoff retry
 * for cloud databases, connection poolers, and cold starts.
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

  // Attach resilient retry extension across all queries and operations
  const extendedClient = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const maxRetries = 3;
          let attempt = 0;
          let delayMs = 150;

          while (true) {
            try {
              return await query(args);
            } catch (error: any) {
              attempt++;
              if (isRetryableError(error) && attempt <= maxRetries) {
                const jitter = Math.random() * 50;
                console.warn(
                  `[Prisma Retry] Transient DB error (${error?.code || error?.name}) on ${String(model)}.${operation}. Retrying attempt ${attempt}/${maxRetries} in ${Math.round(delayMs + jitter)}ms...`
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

const globalForPrisma = globalThis as unknown as { 
  prisma: PrismaClient;
  keepaliveTimer?: NodeJS.Timeout;
};

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Periodically pings the database every 2.5 minutes to prevent cloud NAT/firewall idle connection drops
 */
export function startDatabaseKeepalive() {
  if (globalForPrisma.keepaliveTimer) return;

  globalForPrisma.keepaliveTimer = setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err: any) {
      if (isRetryableError(err)) {
        console.warn('[DB Keepalive] Transient ping drop detected, connection pool auto-refreshing...');
      }
    }
  }, 150000); // 2.5 minutes

  if (globalForPrisma.keepaliveTimer.unref) {
    globalForPrisma.keepaliveTimer.unref();
  }
}

// Graceful cleanup on server termination
const handleGracefulShutdown = async (signal: string) => {
  if (globalForPrisma.keepaliveTimer) {
    clearInterval(globalForPrisma.keepaliveTimer);
  }
  try {
    await prisma.$disconnect();
    console.log(`[Prisma] Database connection closed cleanly on ${signal}.`);
  } catch (err) {
    // Ignore disconnect errors during exit
  }
};

process.once('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.once('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

export default prisma;
