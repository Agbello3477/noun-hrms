import { PrismaClient } from '@prisma/client';
import { prisma as primaryPrisma, createPrismaClient } from './prisma';

// If DATABASE_URL_REPLICA is provided and distinct from DATABASE_URL, instantiate a dedicated read replica client
const replicaUrl = process.env.DATABASE_URL_REPLICA?.trim();
const hasDedicatedReplica = Boolean(replicaUrl && replicaUrl !== process.env.DATABASE_URL?.trim());

let replicaClientInstance: PrismaClient | null = null;
if (hasDedicatedReplica && replicaUrl) {
  try {
    replicaClientInstance = createPrismaClient(replicaUrl);
    console.log('[Prisma Multi-AZ] Initialized dedicated Read Replica connection for cloud high-availability');
  } catch (err) {
    console.warn('[Prisma Multi-AZ] Failed to initialize read replica client, defaulting to primary:', err);
    replicaClientInstance = null;
  }
}

export const prisma = primaryPrisma;
export const prismaReplica = replicaClientInstance || primaryPrisma;

/**
 * Utility function to route queries based on operations.
 * Operations with readOnly=true will hit the read-replica (or primary with automatic failover).
 * Operations with readOnly=false (writes, transactions) hit the primary client.
 */
export function db(readOnly = false): PrismaClient {
  if (readOnly && replicaClientInstance) {
    return replicaClientInstance;
  }
  return primaryPrisma;
}

export default primaryPrisma;
