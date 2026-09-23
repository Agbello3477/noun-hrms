import { Request, Response } from 'express';
import { OfficialApplicationStatus, Role } from '@prisma/client';
import prisma from '../prisma';
import { notifyUser } from './notification.controller';
import { StorageService } from '../services/storage.service';

/**
 * Generate a sequential/unique Reference Number: APP/NOUN/REG/YYYY/XXXX
 */
async function generateReferenceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.officialApplication.count({
        where: {
            createdAt: {
                gte: new Date(`${year}-01-01T00:00:00.000Z`),
                lte: new Date(`${year}-12-31T23:59:59.999Z`),
            }
        }
    });
    const serial = String(count + 1).padStart(4, '0');
    return `APP/NOUN/REG/${year}/${serial}`;
}

/**
 * Generate a unique Registry Stamp Number: REG-ACK-YYYY-XXXX
 */
function generateStampNumber(): string {
    const year = new Date().getFullYear();
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    return `REG-ACK-${year}-${randomHex}`;
}

/**
 * Create a new Official Application to HR / Registry
 * POST /api/official-applications
 */
export const createApplication = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                staffProfile: {
                    include: {
                        unit: true,
                        studyCenter: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const {
            subject,
            category = 'GENERAL_REQUEST',
            content,
            urgency = 'NORMAL',
            targetDirectorate = 'CENTRAL_REGISTRY_HR',
            customUnit,
            customRank
        } = req.body;

        if (!subject || !content) {
            return res.status(400).json({ message: 'Subject and letter content are required.' });
        }

        // Process file attachment if uploaded via Multer
        let attachmentUrl: string | null = null;
        let attachmentName: string | null = null;
        if (req.file) {
            const uploaded = await StorageService.uploadFile(req.file, 'applications');
            attachmentUrl = uploaded;
            attachmentName = req.file.originalname;
        } else if (req.body.attachmentUrl) {
            attachmentUrl = req.body.attachmentUrl;
            attachmentName = req.body.attachmentName || 'Attachment';
        }

        const referenceNumber = await generateReferenceNumber();

        const profile = user.staffProfile;
        const applicantName = user.name || `${profile?.surname || ''} ${profile?.otherNames || ''}`.trim() || 'Staff Member';
        const applicantStaffId = profile?.staffId || null;
        const applicantRank = customRank || profile?.rank || profile?.cadre || user.role;
        const applicantUnit = customUnit || profile?.unit?.name || profile?.studyCenter?.name || 'Department / Unit';
        const applicantRole = user.role;
        const unitId = profile?.unitId || null;

        const application = await prisma.officialApplication.create({
            data: {
                referenceNumber,
                applicantId: userId,
                applicantName,
                applicantStaffId,
                applicantRank,
                applicantUnit,
                applicantRole,
                unitId,
                targetDirectorate,
                category,
                subject,
                content,
                urgency,
                attachmentUrl,
                attachmentName,
                status: OfficialApplicationStatus.PENDING_ACKNOWLEDGMENT
            }
        });

        // Notify all HR Admins / Registry
        const registryAdmins = await prisma.user.findMany({
            where: {
                role: { in: [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN] }
            },
            select: { id: true }
        });

        const notifyMsg = `New official application '${subject}' (${referenceNumber}) submitted by ${applicantName} [${applicantUnit}].`;
        for (const admin of registryAdmins) {
            await notifyUser(
                admin.id,
                'New Official Application to Registry',
                notifyMsg,
                urgency === 'HIGH_PRIORITY' || urgency === 'URGENT' ? 'WARNING' : 'INFO',
                '/dashboard/registry/applications'
            );
        }

        return res.status(201).json({
            message: 'Official application submitted successfully to Central Registry.',
            application
        });
    } catch (error: any) {
        console.error('Error creating official application:', error);
        return res.status(500).json({ message: error.message || 'Failed to submit official application.' });
    }
};

/**
 * Get current user's submitted applications
 * GET /api/official-applications/my
 */
export const getMyApplications = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user?.id;
        const applications = await prisma.officialApplication.findMany({
            where: { applicantId: userId },
            include: {
                acknowledgedBy: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                        email: true
                    }
                },
                unit: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return res.json(applications);
    } catch (error: any) {
        console.error('Error fetching my applications:', error);
        return res.status(500).json({ message: 'Failed to retrieve applications.' });
    }
};

/**
 * Get incoming applications for Registry queue
 * GET /api/official-applications/incoming
 */
export const getIncomingApplications = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const role = req.user?.role;
        if (![Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR].includes(role)) {
            return res.status(403).json({ message: 'Access denied. Registry roles only.' });
        }

        const { status, category, urgency, search, page = '1', limit = '20' } = req.query;

        const where: any = {};
        if (status && status !== 'ALL') {
            where.status = status as OfficialApplicationStatus;
        }
        if (category && category !== 'ALL') {
            where.category = category as string;
        }
        if (urgency && urgency !== 'ALL') {
            where.urgency = urgency as string;
        }
        if (search) {
            const query = String(search).trim();
            where.OR = [
                { subject: { contains: query, mode: 'insensitive' } },
                { referenceNumber: { contains: query, mode: 'insensitive' } },
                { applicantName: { contains: query, mode: 'insensitive' } },
                { applicantStaffId: { contains: query, mode: 'insensitive' } },
                { applicantUnit: { contains: query, mode: 'insensitive' } },
            ];
        }

        const pageNum = Math.max(1, parseInt(page as string) || 1);
        const take = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
        const skip = (pageNum - 1) * take;

        const [applications, total, pendingCount, acknowledgedCount] = await Promise.all([
            prisma.officialApplication.findMany({
                where,
                include: {
                    applicant: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                            staffProfile: {
                                select: {
                                    staffId: true,
                                    rank: true,
                                    department: true,
                                    passportUrl: true
                                }
                            }
                        }
                    },
                    acknowledgedBy: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    }
                },
                orderBy: [
                    { status: 'asc' }, // PENDING first
                    { createdAt: 'desc' }
                ],
                skip,
                take
            }),
            prisma.officialApplication.count({ where }),
            prisma.officialApplication.count({ where: { status: OfficialApplicationStatus.PENDING_ACKNOWLEDGMENT } }),
            prisma.officialApplication.count({ where: { status: OfficialApplicationStatus.ACKNOWLEDGED } })
        ]);

        return res.json({
            data: applications,
            total,
            page: pageNum,
            pages: Math.ceil(total / take),
            counts: {
                pending: pendingCount,
                acknowledged: acknowledgedCount,
                total
            }
        });
    } catch (error: any) {
        console.error('Error fetching incoming applications:', error);
        return res.status(500).json({ message: 'Failed to fetch incoming applications.' });
    }
};

/**
 * Get single application by ID
 * GET /api/official-applications/:id
 */
export const getApplicationById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const userId = req.user?.id;
        // @ts-ignore
        const role = req.user?.role;

        const application = await prisma.officialApplication.findUnique({
            where: { id },
            include: {
                applicant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        staffProfile: {
                            select: {
                                staffId: true,
                                rank: true,
                                passportUrl: true,
                                unit: { select: { name: true } }
                            }
                        }
                    }
                },
                acknowledgedBy: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                        email: true
                    }
                },
                unit: true
            }
        });

        if (!application) {
            return res.status(404).json({ message: 'Application not found.' });
        }

        // Security check: must be applicant or Registry/Admin
        const isRegistry = [Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR].includes(role);
        if (application.applicantId !== userId && !isRegistry) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        return res.json(application);
    } catch (error: any) {
        console.error('Error fetching application details:', error);
        return res.status(500).json({ message: 'Failed to retrieve application details.' });
    }
};

/**
 * Acknowledge & Apply Electronic Registry Stamp
 * PUT /api/official-applications/:id/acknowledge
 */
export const acknowledgeApplication = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const officerId = req.user?.id;
        // @ts-ignore
        const role = req.user?.role;

        if (![Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR].includes(role)) {
            return res.status(403).json({ message: 'Only Registry officers can acknowledge and stamp applications.' });
        }

        const officer = await prisma.user.findUnique({
            where: { id: officerId },
            include: { staffProfile: true }
        });

        const existing = await prisma.officialApplication.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ message: 'Application not found.' });
        }

        const {
            registryRemarks = 'Application received and logged into NOUN Central Registry records.',
            registryOfficerDesignation = 'Central Registry Receiving Officer'
        } = req.body;

        const acknowledgedAt = new Date();
        const registryStampNumber = existing.registryStampNumber || generateStampNumber();
        const registryOfficerName = officer?.name || 'Registry Officer';

        const updated = await prisma.officialApplication.update({
            where: { id },
            data: {
                status: OfficialApplicationStatus.ACKNOWLEDGED,
                acknowledgedById: officerId,
                acknowledgedAt,
                registryStampNumber,
                registryRemarks,
                registryOfficerName,
                registryOfficerDesignation,
                metadata: {
                    stampedAt: acknowledgedAt.toISOString(),
                    stampSerial: registryStampNumber,
                    officerEmail: officer?.email,
                    institution: 'National Open University of Nigeria',
                    registryDivision: 'Central Registry & Human Resources'
                }
            },
            include: {
                applicant: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                acknowledgedBy: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                }
            }
        });

        // Dispatch instant notification to applicant
        await notifyUser(
            existing.applicantId,
            'Application Acknowledged & Stamped',
            `Central Registry has acknowledged receipt of your application '${existing.subject}'. Official Registry Stamp Serial: ${registryStampNumber}. Stamped copy is now available.`,
            'SUCCESS',
            `/dashboard/leaves?tab=official&appId=${existing.id}`
        );

        return res.json({
            message: 'Application successfully acknowledged and stamped with official Registry seal.',
            application: updated
        });
    } catch (error: any) {
        console.error('Error acknowledging application:', error);
        return res.status(500).json({ message: error.message || 'Failed to acknowledge application.' });
    }
};

/**
 * Update Application Processing Status (IN_REVIEW, APPROVED, REJECTED)
 * PUT /api/official-applications/:id/status
 */
export const updateApplicationStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const role = req.user?.role;
        if (![Role.HR_ADMIN, Role.SUPER_USER, Role.ADMIN, Role.VICE_CHANCELLOR].includes(role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const { status, remarks } = req.body;
        if (!status || !Object.values(OfficialApplicationStatus).includes(status)) {
            return res.status(400).json({ message: 'Valid status is required.' });
        }

        const updated = await prisma.officialApplication.update({
            where: { id },
            data: {
                status,
                ...(remarks ? { registryRemarks: remarks } : {})
            }
        });

        // Notify applicant
        await notifyUser(
            updated.applicantId,
            `Application Status Updated: ${status.replace('_', ' ')}`,
            `Your official application '${updated.subject}' status was updated to ${status.replace('_', ' ')}.`,
            status === 'APPROVED' ? 'SUCCESS' : status === 'REJECTED' ? 'ERROR' : 'INFO',
            `/dashboard/leaves?tab=official&appId=${updated.id}`
        );

        return res.json({
            message: `Application status updated to ${status}.`,
            application: updated
        });
    } catch (error: any) {
        console.error('Error updating application status:', error);
        return res.status(500).json({ message: 'Failed to update application status.' });
    }
};
