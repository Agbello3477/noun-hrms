import { Router, Request, Response } from 'express';
import { verifyToken } from '../../middleware/auth.middleware';
import { requireAuthorizerRole, validateDualControlSelfAuthorization } from '../../middleware/rbac.middleware';
import prisma from '../../prisma';
import { Role, TransferStatus, AuthorizationEntityType, AuthorizationActionTaken } from '@prisma/client';
import { sendAccountCreatedNotification } from '../../services/email.service';
import { notifyUser } from '../../controllers/notification.controller';
import crypto from 'crypto';

const router = Router();

// Apply Authentication and Authorizer-only guard to all routes
router.use(verifyToken);
router.use(requireAuthorizerRole);

/**
 * GET /api/v1/registrar/queue
 * Aggregated Executive Authorization Queue for the Registrar Cockpit.
 */
router.get('/queue', async (req: Request, res: Response) => {
    try {
        const [pendingPostings, pendingFiles, pendingOverrides, pendingQueries] = await Promise.all([
            prisma.transferLog.count({
                where: {
                    status: {
                        in: [TransferStatus.PENDING_REGISTRAR_APPROVAL, TransferStatus.PENDING_REGISTRAR_AUTHORIZATION]
                    }
                }
            }),
            prisma.staffProfile.count({
                where: {
                    accountStatus: 'PENDING_REGISTRAR_CLEARANCE',
                    isDeleted: false
                }
            }),
            prisma.staffProfile.count({
                where: {
                    promotionOverrideStatus: 'PENDING_REGISTRAR_OVERRIDE',
                    isDeleted: false
                }
            }),
            prisma.staffQuery.count({
                where: {
                    status: 'OPEN'
                }
            })
        ]);

        res.json({
            queueSummary: {
                totalPending: pendingPostings + pendingFiles + pendingOverrides + pendingQueries,
                postings: pendingPostings,
                files: pendingFiles,
                promotionOverrides: pendingOverrides,
                disciplinaryQueries: pendingQueries
            }
        });
    } catch (error: any) {
        console.error('Error fetching executive queue:', error);
        res.status(500).json({ message: 'Failed to fetch executive queue', error: error.message });
    }
});

/**
 * GET /api/v1/registrar/postings/pending
 * List all postings awaiting Registrar authorization.
 */
router.get('/postings/pending', async (req: Request, res: Response) => {
    try {
        const pending = await prisma.transferLog.findMany({
            where: {
                status: {
                    in: [TransferStatus.PENDING_REGISTRAR_APPROVAL, TransferStatus.PENDING_REGISTRAR_AUTHORIZATION]
                }
            },
            include: {
                staff: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        staffProfile: {
                            select: {
                                id: true,
                                staffId: true,
                                surname: true,
                                otherNames: true,
                                rank: true,
                                cadre: true,
                                level: true,
                                stateOfOrigin: true,
                                passportUrl: true,
                                unit: { select: { id: true, name: true } },
                                studyCenter: { select: { id: true, name: true } }
                            }
                        }
                    }
                },
                initiatedBy: { select: { id: true, name: true, email: true, role: true } },
                oldUnit: { select: { id: true, name: true } },
                newUnit: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(pending);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch pending postings', error: error.message });
    }
});

/**
 * PUT /api/v1/registrar/postings/:id/authorize
 * Authorize, Reject, or Return a posting order with cryptographic stamp.
 * Enforces strict self-authorization prevention.
 */
const handleAuthorizePosting = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { decision = 'APPROVED', remarks = '', digitalSignatureRef } = req.body;
        // @ts-ignore
        const authorizerId = req.user?.id;

        const posting = await prisma.transferLog.findUnique({
            where: { id },
            include: {
                staff: {
                    include: {
                        staffProfile: true
                    }
                },
                initiatedBy: true
            }
        });

        if (!posting) {
            return res.status(404).json({ message: 'Staff posting record not found' });
        }

        // Immutable Dual-Control Check: authorizer cannot be the imputer
        if (posting.initiatedById === authorizerId) {
            return res.status(403).json({
                message: 'Self-authorization is strictly prohibited. The creating officer cannot authorize or ratify this record.'
            });
        }

        const now = new Date();
        const digitalStamp = digitalSignatureRef || `NOUN-REGISTRAR-STAMP-${Date.now().toString(36).toUpperCase()}`;

        if (decision === 'APPROVED') {
            await prisma.$transaction(async (tx) => {
                await tx.transferLog.update({
                    where: { id: posting.id },
                    data: {
                        status: TransferStatus.AUTHORIZED,
                        isEffective: true,
                        applied: true,
                        authorizedById: authorizerId,
                        authorizedAt: now,
                        authorizationRemarks: remarks || 'Ratified & Authorized by Registrar',
                        digitalSignatureRef: digitalStamp
                    }
                });

                // Apply update to staff profile placement
                if (posting.staff?.staffProfile) {
                    await tx.staffProfile.update({
                        where: { id: posting.staff.staffProfile.id },
                        data: {
                            unitId: posting.newUnitId || undefined,
                            centerId: posting.newCenterId || undefined
                        }
                    });
                }

                // Dual-Control Audit Record
                await tx.authorizationAuditTrail.create({
                    data: {
                        entityType: AuthorizationEntityType.STAFF_POSTING,
                        entityId: posting.id,
                        imputerId: posting.initiatedById,
                        imputerIp: req.ip,
                        imputedAt: posting.createdAt,
                        authorizerId,
                        authorizerIp: req.ip,
                        authorizedAt: now,
                        actionTaken: AuthorizationActionTaken.APPROVED,
                        remarks: remarks || 'Officially ratified by Registrar',
                        digitalStampRef: digitalStamp,
                        metadata: {
                            staffName: posting.staff.name,
                            newUnitId: posting.newUnitId,
                            newCenterId: posting.newCenterId
                        }
                    }
                });
            });

            // Notify Imputer
            await notifyUser(
                posting.initiatedById,
                '✅ Posting Order Authorized',
                `Staff posting for ${posting.staff.name} has been authorized and ratified by the Registrar.`,
                'SUCCESS',
                '/registry-workspace'
            ).catch(() => {});

            return res.json({
                message: 'Staff posting order successfully authorized and executed.',
                status: 'AUTHORIZED',
                digitalStampRef: digitalStamp,
                authorizedAt: now
            });
        } else if (decision === 'REJECTED') {
            if (!remarks || remarks.trim().length < 5) {
                return res.status(400).json({ message: 'Mandatory remarks (minimum 5 characters) required for rejecting a posting order.' });
            }

            await prisma.$transaction(async (tx) => {
                await tx.transferLog.update({
                    where: { id: posting.id },
                    data: {
                        status: TransferStatus.REJECTED,
                        authorizedById: authorizerId,
                        authorizedAt: now,
                        rejectionReason: remarks
                    }
                });

                await tx.authorizationAuditTrail.create({
                    data: {
                        entityType: AuthorizationEntityType.STAFF_POSTING,
                        entityId: posting.id,
                        imputerId: posting.initiatedById,
                        imputerIp: req.ip,
                        imputedAt: posting.createdAt,
                        authorizerId,
                        authorizerIp: req.ip,
                        authorizedAt: now,
                        actionTaken: AuthorizationActionTaken.REJECTED,
                        remarks,
                        metadata: { staffName: posting.staff.name }
                    }
                });
            });

            await notifyUser(
                posting.initiatedById,
                '❌ Posting Order Rejected',
                `Staff posting for ${posting.staff.name} was rejected by the Registrar. Reason: ${remarks}`,
                'ERROR',
                '/registry-workspace'
            ).catch(() => {});

            return res.json({
                message: 'Staff posting order rejected.',
                status: 'REJECTED'
            });
        } else if (decision === 'RETURNED_TO_IMPUTER') {
            await prisma.$transaction(async (tx) => {
                await tx.transferLog.update({
                    where: { id: posting.id },
                    data: {
                        status: TransferStatus.RETURNED_FOR_REVIEW,
                        authorizationRemarks: remarks || 'Returned for review'
                    }
                });

                await tx.authorizationAuditTrail.create({
                    data: {
                        entityType: AuthorizationEntityType.STAFF_POSTING,
                        entityId: posting.id,
                        imputerId: posting.initiatedById,
                        imputerIp: req.ip,
                        imputedAt: posting.createdAt,
                        authorizerId,
                        authorizerIp: req.ip,
                        authorizedAt: now,
                        actionTaken: AuthorizationActionTaken.RETURNED_TO_IMPUTER,
                        remarks,
                        metadata: { staffName: posting.staff.name }
                    }
                });
            });

            await notifyUser(
                posting.initiatedById,
                '↩️ Posting Returned for Review',
                `Posting order for ${posting.staff.name} was returned by the Registrar with notes: ${remarks}`,
                'WARNING',
                '/registry-workspace'
            ).catch(() => {});

            return res.json({
                message: 'Posting order returned to imputer for review.',
                status: 'RETURNED_FOR_REVIEW'
            });
        }

        res.status(400).json({ message: 'Invalid decision type' });
    } catch (error: any) {
        console.error('Error authorizing posting:', error);
        res.status(500).json({ message: 'Internal server error authorizing posting', error: error.message });
    }
};

router.put('/postings/:id/authorize', handleAuthorizePosting);
router.post('/postings/:id/authorize', handleAuthorizePosting);

/**
 * GET /api/v1/registrar/files/pending
 * List all staff files awaiting clearance.
 */
router.get('/files/pending', async (req: Request, res: Response) => {
    try {
        const files = await prisma.staffProfile.findMany({
            where: {
                accountStatus: 'PENDING_REGISTRAR_CLEARANCE',
                isDeleted: false
            },
            include: {
                user: { select: { id: true, name: true, email: true, role: true } },
                unit: { select: { id: true, name: true } },
                studyCenter: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true, email: true, role: true } }
            },
            orderBy: { clearanceSubmittedAt: 'desc' }
        });

        res.json(files);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch files pending clearance', error: error.message });
    }
});

/**
 * PUT /api/v1/registrar/files/:id/clear
 * Registrar authorizes and clears digital staff file.
 * Activates user account and triggers activation email worker with one-time setup token.
 */
const handleClearFile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;
        // @ts-ignore
        const authorizerId = req.user?.id;

        const profile = await prisma.staffProfile.findFirst({
            where: {
                OR: [{ id }, { userId: id }, { staffId: id }],
                isDeleted: false
            },
            include: { user: true, createdBy: true }
        });

        if (!profile) {
            return res.status(404).json({ message: 'Staff file not found' });
        }

        // Immutable Dual-Control Check: creating imputer cannot clear the file
        if (profile.createdById === authorizerId) {
            return res.status(403).json({
                message: 'Self-authorization is strictly prohibited. The creating officer cannot clear or sign off on their own record.'
            });
        }

        const now = new Date();
        const setupToken = crypto.randomBytes(24).toString('hex');
        const digitalStamp = `NOUN-CLEARANCE-STAMP-${Date.now().toString(36).toUpperCase()}`;

        await prisma.$transaction(async (tx) => {
            await tx.staffProfile.update({
                where: { id: profile.id },
                data: {
                    accountStatus: 'CLEARED_ACTIVE',
                    isActivated: true,
                    clearedAt: now,
                    clearedById: authorizerId,
                    clearanceRemarks: remarks || 'Officially cleared by Registrar'
                }
            });

            await tx.user.update({
                where: { id: profile.userId },
                data: {
                    isActive: true
                }
            });

            // Record in Dual-Control Audit Trail
            await tx.authorizationAuditTrail.create({
                data: {
                    entityType: AuthorizationEntityType.FILE_CREATION,
                    entityId: profile.id,
                    imputerId: profile.createdById || profile.userId,
                    imputerIp: req.ip,
                    imputedAt: profile.clearanceSubmittedAt || profile.createdAt,
                    authorizerId,
                    authorizerIp: req.ip,
                    authorizedAt: now,
                    actionTaken: AuthorizationActionTaken.APPROVED,
                    remarks: remarks || 'Staff file cleared and activated',
                    digitalStampRef: digitalStamp,
                    metadata: {
                        staffId: profile.staffId,
                        name: profile.user.name,
                        setupTokenGenerated: true
                    }
                }
            });
        });

        // Trigger account activation notification worker immediately with one-time setup token
        const staffName = profile.user.name || `${profile.surname || ''} ${profile.otherNames || ''}`.trim() || 'Staff';
        sendAccountCreatedNotification(profile.user.email, profile.phone || null, staffName, profile.staffId || 'N/A', setupToken).catch(err => {
            console.error('[ACTIVATION_WORKER] Failed to dispatch activation email on clearance:', err);
        });

        // Notify Imputer
        if (profile.createdById) {
            await notifyUser(
                profile.createdById,
                '✅ Staff File Cleared by Registrar',
                `Staff file for ${staffName} (${profile.staffId}) has been cleared and activated.`,
                'SUCCESS',
                '/registry-workspace'
            ).catch(() => {});
        }

        res.json({
            message: 'Staff file cleared and account activated successfully.',
            status: 'CLEARED_ACTIVE',
            isActivated: true,
            setupToken,
            clearedAt: now,
            digitalStampRef: digitalStamp
        });
    } catch (error: any) {
        console.error('Error clearing staff file:', error);
        res.status(500).json({ message: 'Internal server error clearing staff file', error: error.message });
    }
};

router.put('/files/:id/clear', handleClearFile);
router.post('/files/:id/clear', handleClearFile);

/**
 * PUT /api/v1/registrar/files/:id/reject
 * Reject a staff file clearance request.
 */
router.put('/files/:id/reject', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason = 'Documentation incomplete or invalid' } = req.body;
        // @ts-ignore
        const authorizerId = req.user?.id;

        const profile = await prisma.staffProfile.findFirst({
            where: {
                OR: [{ id }, { userId: id }, { staffId: id }],
                isDeleted: false
            },
            include: { user: true }
        });

        if (!profile) return res.status(404).json({ message: 'Staff file not found' });

        if (profile.createdById === authorizerId) {
            return res.status(403).json({
                message: 'Self-authorization is strictly prohibited. The creating officer cannot reject their own record.'
            });
        }

        const now = new Date();
        await prisma.$transaction(async (tx) => {
            await tx.staffProfile.update({
                where: { id: profile.id },
                data: {
                    accountStatus: 'REJECTED',
                    clearanceRemarks: reason
                }
            });

            await tx.authorizationAuditTrail.create({
                data: {
                    entityType: AuthorizationEntityType.FILE_CREATION,
                    entityId: profile.id,
                    imputerId: profile.createdById || profile.userId,
                    imputerIp: req.ip,
                    imputedAt: profile.clearanceSubmittedAt || profile.createdAt,
                    authorizerId,
                    authorizerIp: req.ip,
                    authorizedAt: now,
                    actionTaken: AuthorizationActionTaken.REJECTED,
                    remarks: reason,
                    metadata: { staffId: profile.staffId, name: profile.user.name }
                }
            });
        });

        if (profile.createdById) {
            await notifyUser(
                profile.createdById,
                '❌ Staff File Clearance Rejected',
                `Staff file for ${profile.user.name} was rejected by the Registrar. Reason: ${reason}`,
                'ERROR',
                '/registry-workspace'
            ).catch(() => {});
        }

        res.json({ message: 'Staff file clearance rejected successfully.', status: 'REJECTED' });
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to reject file clearance', error: error.message });
    }
});

/**
 * GET /api/v1/registrar/promotions/pending-overrides
 * List all promotion overrides awaiting executive approval.
 */
router.get('/promotions/pending-overrides', async (req: Request, res: Response) => {
    try {
        const overrides = await prisma.staffProfile.findMany({
            where: {
                promotionOverrideStatus: 'PENDING_REGISTRAR_OVERRIDE',
                isDeleted: false
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                unit: { select: { id: true, name: true } },
                studyCenter: { select: { id: true, name: true } }
            },
            orderBy: { promotionOverrideRequestedAt: 'desc' }
        });

        res.json(overrides);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch promotion overrides', error: error.message });
    }
});

/**
 * PUT /api/v1/registrar/promotions/:id/authorize-override
 * Approve or reject a staged promotion override.
 */
router.put('/promotions/:id/authorize-override', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { decision = 'APPROVED', remarks } = req.body;
        // @ts-ignore
        const authorizerId = req.user?.id;

        const profile = await prisma.staffProfile.findUnique({
            where: { id },
            include: { user: true }
        });

        if (!profile) return res.status(404).json({ message: 'Staff profile not found' });

        // Dual control check
        if (profile.promotionOverrideRequestedById === authorizerId) {
            return res.status(403).json({
                message: 'Self-authorization is strictly prohibited. The requesting officer cannot authorize this override.'
            });
        }

        const now = new Date();

        if (decision === 'APPROVED') {
            const targetDueYear = profile.requestedPromotionDueYear || (profile.nextDueYear ? profile.nextDueYear - 1 : 2026);
            await prisma.$transaction(async (tx) => {
                await tx.staffProfile.update({
                    where: { id: profile.id },
                    data: {
                        nextDueYear: targetDueYear,
                        nextPromotionDueYear: targetDueYear,
                        registryOverride: true,
                        overrideReason: profile.promotionOverrideJustification || remarks || 'Approved by Registrar',
                        promotionOverrideStatus: 'APPROVED',
                        promotionOverrideApprovedById: authorizerId,
                        promotionOverrideApprovedAt: now,
                        eligibilityStatus: 'DUE_FOR_REVIEW',
                        promotionEligibilityStatus: 'DUE_FOR_REVIEW'
                    }
                });

                await tx.authorizationAuditTrail.create({
                    data: {
                        entityType: AuthorizationEntityType.PROMOTION_OVERRIDE,
                        entityId: profile.id,
                        imputerId: profile.promotionOverrideRequestedById || authorizerId,
                        imputerIp: req.ip,
                        imputedAt: profile.promotionOverrideRequestedAt || now,
                        authorizerId,
                        authorizerIp: req.ip,
                        authorizedAt: now,
                        actionTaken: AuthorizationActionTaken.APPROVED,
                        remarks: remarks || profile.promotionOverrideJustification || 'Promotion override approved',
                        metadata: {
                            staffName: profile.user.name,
                            newDueYear: targetDueYear
                        }
                    }
                });
            });

            return res.json({ message: 'Promotion override authorized successfully.', status: 'APPROVED' });
        } else {
            await prisma.$transaction(async (tx) => {
                await tx.staffProfile.update({
                    where: { id: profile.id },
                    data: {
                        promotionOverrideStatus: 'REJECTED'
                    }
                });

                await tx.authorizationAuditTrail.create({
                    data: {
                        entityType: AuthorizationEntityType.PROMOTION_OVERRIDE,
                        entityId: profile.id,
                        imputerId: profile.promotionOverrideRequestedById || authorizerId,
                        imputerIp: req.ip,
                        imputedAt: profile.promotionOverrideRequestedAt || now,
                        authorizerId,
                        authorizerIp: req.ip,
                        authorizedAt: now,
                        actionTaken: AuthorizationActionTaken.REJECTED,
                        remarks: remarks || 'Promotion override rejected',
                        metadata: { staffName: profile.user.name }
                    }
                });
            });

            return res.json({ message: 'Promotion override rejected.', status: 'REJECTED' });
        }
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to process promotion override', error: error.message });
    }
});

/**
 * GET /api/v1/registrar/audits
 * Exportable Audit Dossier for Internal Audit and Council oversight.
 */
router.get('/audits', async (req: Request, res: Response) => {
    try {
        const { entityType, actionTaken, format } = req.query as {
            entityType?: string;
            actionTaken?: string;
            format?: string;
        };

        const where: any = {};
        if (entityType) where.entityType = entityType as AuthorizationEntityType;
        if (actionTaken) where.actionTaken = actionTaken as AuthorizationActionTaken;

        const audits = await prisma.authorizationAuditTrail.findMany({
            where,
            include: {
                imputer: { select: { id: true, name: true, email: true, role: true } },
                authorizer: { select: { id: true, name: true, email: true, role: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 200
        });

        if (format === 'csv') {
            let csv = 'ID,EntityType,EntityID,ImputerName,ImputerEmail,ImputerRole,ImputedAt,AuthorizerName,AuthorizerEmail,AuthorizedAt,ActionTaken,Remarks,DigitalStampRef\n';
            for (const a of audits) {
                csv += `"${a.id}","${a.entityType}","${a.entityId}","${a.imputer?.name || ''}","${a.imputer?.email || ''}","${a.imputer?.role || ''}","${a.imputedAt.toISOString()}","${a.authorizer?.name || ''}","${a.authorizer?.email || ''}","${a.authorizedAt?.toISOString() || ''}","${a.actionTaken}","${(a.remarks || '').replace(/"/g, '""')}","${a.digitalStampRef || ''}"\n`;
            }
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="registrar_authorization_dossier.csv"');
            return res.send(csv);
        }

        res.json({
            count: audits.length,
            audits
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch audit dossier', error: error.message });
    }
});

export default router;
