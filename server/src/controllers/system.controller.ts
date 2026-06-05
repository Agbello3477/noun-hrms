import { Request, Response } from 'express';
import prisma from '../prisma';

export const getAuditLogs = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const action = req.query.action as string;
        const resource = req.query.resource as string;
        const search = req.query.search as string;

        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {};

        if (action) {
            where.action = action;
        }

        if (resource) {
            where.resource = resource;
        }

        if (search) {
            where.OR = [
                {
                    details: {
                        contains: search,
                        mode: 'insensitive'
                    }
                },
                {
                    action: {
                        contains: search,
                        mode: 'insensitive'
                    }
                },
                {
                    resource: {
                        contains: search,
                        mode: 'insensitive'
                    }
                },
                {
                    user: {
                        name: {
                            contains: search,
                            mode: 'insensitive'
                        }
                    }
                },
                {
                    user: {
                        email: {
                            contains: search,
                            mode: 'insensitive'
                        }
                    }
                }
            ];
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                skip,
                take: limit
            }),
            prisma.auditLog.count({ where })
        ]);

        res.json({
            logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching system audit logs:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
