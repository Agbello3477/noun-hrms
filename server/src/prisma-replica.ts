import { PrismaClient } from '@prisma/client';

const writeClient = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
});

const replicaClient = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL_REPLICA || process.env.DATABASE_URL
        }
    }
});

// Log warnings if replica falls back to master in prod
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL_REPLICA) {
    console.warn('[Prisma] Read Replica URL is not configured. Falling back to Primary Database for reads.');
}

export const prisma = writeClient;
export const prismaReplica = replicaClient;

/**
 * Utility function to route queries based on operations.
 * Operations with readOnly=true will hit the secondary read replica (if configured).
 * Operations with readOnly=false (writes, transactions) must hit the primary database.
 */
export function db(readOnly = false): PrismaClient {
    return readOnly ? replicaClient : writeClient;
}

export default prisma;
