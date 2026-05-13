import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const AuditService = {
    log: async (userId: string, action: string, resource: string, details?: string, ipAddress?: string) => {
        try {
            await prisma.auditLog.create({
                data: {
                    userId,
                    action,
                    resource,
                    details,
                    ipAddress
                }
            });
        } catch (error) {
            console.error('Audit Log Failed:', error);
            // Fail silently? Or throw? Usually fail silently to not block main flow, but log critical error.
        }
    },

    // Helper for consistent action naming
    ACTIONS: {
        VIEW: 'VIEW',
        CREATE: 'CREATE',
        UPDATE: 'UPDATE',
        DELETE: 'DELETE',
        LOGIN: 'LOGIN',
        DOWNLOAD: 'DOWNLOAD',
        MOVE: 'MOVE', // Workflow
    }
};
