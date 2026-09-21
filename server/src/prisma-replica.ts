import { PrismaClient } from '@prisma/client';
import { prisma as stabilizedPrisma } from './prisma';

export const prisma = stabilizedPrisma;
export const prismaReplica = stabilizedPrisma;

/**
 * Utility function to route queries based on operations.
 * Operations with readOnly=true will hit the stabilized database client.
 * Operations with readOnly=false (writes, transactions) hit the stabilized primary client.
 */
export function db(_readOnly = false): PrismaClient {
    return stabilizedPrisma;
}

export default stabilizedPrisma;

