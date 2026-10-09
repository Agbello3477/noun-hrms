import { Router, Request, Response } from 'express';
import { verifyToken } from '../../middleware/auth.middleware';
import { requireAuthorizerRole, validateDualControlSelfAuthorization } from '../../middleware/rbac.middleware';
import { enforceMakerChecker } from '../../middleware/enforceMakerChecker';
import prisma from '../../prisma';
import { Role, TransferStatus, AuthorizationEntityType, AuthorizationActionTaken } from '@prisma/client';
import { sendAccountCreatedNotification } from '../../services/email.service';
import { notifyUser } from '../../controllers/notification.controller';
import { redisService } from '../../services/redis.service';
import { cacheInvalidationService } from '../../services/cacheInvalidationService';
import { ProbationConfirmationService } from '../../services/ProbationConfirmationService';
import { DisciplinaryPayrollService } from '../../services/DisciplinaryPayrollService';
import { TrainingBondGuard } from '../../services/TrainingBondGuard';
import { PostingAllowanceEngine } from '../../services/PostingAllowanceEngine';
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
        const [
            pendingPostings, 
            pendingFiles, 
            pendingOverrides, 
            pendingQueries, 
            pendingRoleChanges, 
            pendingApplications, 
            pendingFileReleases,
            pendingConfirmations,
            activeBonds
        ] = await Promise.all([
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
            }),
            prisma.user.count({
                where: {
                    roleChangeStatus: 'PENDING_REGISTRAR_APPROVAL'
                }
            }),
            prisma.institutionalApplication.count({
                where: {
                    status: 'DOCKETED_PENDING_REGISTRAR'
                }
            }),
            prisma.fileRequisition.count({
                where: {
                    status: 'ACKNOWLEDGED_PENDING_REGISTRAR'
                }
            }),
            prisma.staffProfile.count({
                where: {
                    isDeleted: false,
                    OR: [
                        { confirmationStaged: true },
                        { confirmationStatus: { in: ['ON_PROBATION', 'PROBATION_EXTENDED', 'TERMINATION_RECOMMENDED'] } }
                    ]
                }
            }),
            prisma.trainingBondRecord.count({
                where: {
                    isBondDischarged: false
                }
            })
        ]);

        res.json({
            queueSummary: {
                totalPending: pendingPostings + pendingFiles + pendingOverrides + pendingQueries + pendingRoleChanges + pendingApplications + pendingFileReleases + pendingConfirmations,
                postings: pendingPostings,
                files: pendingFiles,
                promotionOverrides: pendingOverrides,
                disciplinaryQueries: pendingQueries,
                roleChanges: pendingRoleChanges,
                applications: pendingApplications,
                fileReleases: pendingFileReleases,
                confirmations: pendingConfirmations,
                bonds: activeBonds
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
            // Spousal Co-Location Conflict Guard
            if (posting.spousalConflictDetected && !posting.spousalConflictVcApprovalUrl) {
                return res.status(403).json({
                    error: 'SPOUSAL_CONFLICT_APPROVAL_REQUIRED',
                    message: 'SPOUSAL CO-LOCATION RESTRICTION: Husband and wife deployment to the same station requires Vice-Chancellor exemption approval URL before authorization.'
                });
            }

            const isMgmt = posting.isManagementInitiated;
            const staffProfId = posting.staff?.staffProfile?.id || posting.staffId;
            const allowanceCalc = await PostingAllowanceEngine.calculateAllowance(staffProfId, isMgmt);

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
                        digitalSignatureRef: digitalStamp,
                        resettlementAllowanceAmount: allowanceCalc.resettlementAllowanceAmount,
                        resettlementBursaryStatus: allowanceCalc.resettlementBursaryStatus
                    }
                });

                // Also update staffPostings table
                await tx.staffPosting.updateMany({
                    where: { id: posting.id },
                    data: {
                        status: TransferStatus.AUTHORIZED,
                        authorizedById: authorizerId,
                        authorizedAt: now,
                        resettlementAllowanceAmount: allowanceCalc.resettlementAllowanceAmount,
                        resettlementBursaryStatus: allowanceCalc.resettlementBursaryStatus
                    }
                }).catch(() => {});

                // Apply update to staff profile placement with foreign key validation
                const profile = posting.staff?.staffProfile || await tx.staffProfile.findFirst({
                    where: {
                        OR: [
                            { id: posting.staffId },
                            { userId: posting.staffId }
                        ]
                    }
                }).catch(() => null);

                if (profile) {
                    const updateData: any = {};
                    if (posting.newUnitId) {
                        const unitExists = await tx.unit.findUnique({ where: { id: posting.newUnitId } }).catch(() => null);
                        if (unitExists) {
                            updateData.unitId = unitExists.id;
                        }
                    }
                    if (posting.newCenterId && posting.newCenterId !== posting.newUnitId) {
                        const centerExists = await tx.studyCenter.findUnique({ where: { id: posting.newCenterId } }).catch(() => null);
                        if (centerExists) {
                            updateData.centerId = centerExists.id;
                        }
                    }
                    if (Object.keys(updateData).length > 0) {
                        await tx.staffProfile.update({
                            where: { id: profile.id },
                            data: updateData
                        });
                    }
                }

                // Dual-Control Audit Record (safely committed)
                try {
                    await tx.authorizationAuditTrail.create({
                        data: {
                            entityType: AuthorizationEntityType.STAFF_POSTING,
                            entityId: posting.id,
                            imputerId: posting.initiatedById || authorizerId,
                            imputerIp: req.ip,
                            imputedAt: posting.createdAt,
                            authorizerId,
                            authorizerIp: req.ip,
                            authorizedAt: now,
                            actionTaken: AuthorizationActionTaken.APPROVED,
                            remarks: remarks || 'Officially ratified by Registrar',
                            digitalStampRef: digitalStamp,
                            metadata: {
                                staffName: posting.staff?.name || posting.staff?.email || 'Staff',
                                newUnitId: posting.newUnitId,
                                newCenterId: posting.newCenterId
                            }
                        }
                    });
                } catch (auditErr) {
                    console.warn('authorizationAuditTrail notice:', auditErr);
                }

                try {
                    await tx.auditLog.create({
                        data: {
                            userId: authorizerId,
                            action: 'AUTHORIZE_STAFF_TRANSFER',
                            resource: `TransferLog:${posting.id}`,
                            details: JSON.stringify({
                                postingId: posting.id,
                                staffId: posting.staffId,
                                decision: 'APPROVED',
                                remarks
                            }),
                            ipAddress: req.ip
                        }
                    });
                } catch (e) {}
            });

            // Notify Imputer safely
            if (posting.initiatedById) {
                await notifyUser(
                    posting.initiatedById,
                    '✅ Posting Order Authorized',
                    `Staff posting for ${posting.staff?.name || 'Staff Member'} has been authorized and ratified by the Registrar.`,
                    'SUCCESS',
                    '/registry-workspace'
                ).catch(() => {});
            }

            // Invalidate Caches atomically via tags and user session purges
            await Promise.all([
                cacheInvalidationService.invalidateStaffPostings(),
                cacheInvalidationService.invalidateUserCache(posting.staffId),
                redisService.clearPattern('staff:*'),
                redisService.clearPattern('analytics:*'),
                redisService.clearPattern('hr:analytics:*'),
                redisService.clearPattern('registrar:*'),
                redisService.del(`user:session:${posting.staffId}`)
            ]).catch(() => {});

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

                try {
                    await tx.authorizationAuditTrail.create({
                        data: {
                            entityType: AuthorizationEntityType.STAFF_POSTING,
                            entityId: posting.id,
                            imputerId: posting.initiatedById || authorizerId,
                            imputerIp: req.ip,
                            imputedAt: posting.createdAt,
                            authorizerId,
                            authorizerIp: req.ip,
                            authorizedAt: now,
                            actionTaken: AuthorizationActionTaken.REJECTED,
                            remarks,
                            metadata: { staffName: posting.staff?.name || 'Staff' }
                        }
                    });
                } catch (auditErr) {
                    console.warn('authorizationAuditTrail notice:', auditErr);
                }

                try {
                    await tx.auditLog.create({
                        data: {
                            userId: authorizerId,
                            action: 'REJECT_STAFF_TRANSFER',
                            resource: `TransferLog:${posting.id}`,
                            details: JSON.stringify({
                                postingId: posting.id,
                                staffId: posting.staffId,
                                decision: 'REJECTED',
                                reason: remarks
                            }),
                            ipAddress: req.ip
                        }
                    });
                } catch (e) {}
            });

            if (posting.initiatedById) {
                await notifyUser(
                    posting.initiatedById,
                    '❌ Posting Order Rejected',
                    `Staff posting for ${posting.staff?.name || 'Staff Member'} was rejected by the Registrar. Reason: ${remarks}`,
                    'ERROR',
                    '/registry-workspace'
                ).catch(() => {});
            }

            await Promise.all([
                cacheInvalidationService.invalidateStaffPostings(),
                redisService.clearPattern('staff:*'),
                redisService.clearPattern('analytics:*'),
                redisService.clearPattern('registrar:*')
            ]).catch(() => {});

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

                try {
                    await tx.authorizationAuditTrail.create({
                        data: {
                            entityType: AuthorizationEntityType.STAFF_POSTING,
                            entityId: posting.id,
                            imputerId: posting.initiatedById || authorizerId,
                            imputerIp: req.ip,
                            imputedAt: posting.createdAt,
                            authorizerId,
                            authorizerIp: req.ip,
                            authorizedAt: now,
                            actionTaken: AuthorizationActionTaken.RETURNED_TO_IMPUTER,
                            remarks,
                            metadata: { staffName: posting.staff?.name || 'Staff' }
                        }
                    });
                } catch (auditErr) {
                    console.warn('authorizationAuditTrail notice:', auditErr);
                }
            });

            if (posting.initiatedById) {
                await notifyUser(
                    posting.initiatedById,
                    '↩️ Posting Returned for Review',
                    `Posting order for ${posting.staff?.name || 'Staff Member'} was returned by the Registrar with notes: ${remarks}`,
                    'WARNING',
                    '/registry-workspace'
                ).catch(() => {});
            }

            await Promise.all([
                cacheInvalidationService.invalidateStaffPostings(),
                redisService.clearPattern('staff:*'),
                redisService.clearPattern('registrar:*')
            ]).catch(() => {});

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

router.put(
    '/postings/:id/authorize',
    enforceMakerChecker({
        entityType: 'staffPosting',
        paramKey: 'id',
        imputerField: 'imputedById',
        statusField: 'status',
        allowedStatuses: ['PENDING_REGISTRAR_AUTHORIZATION', 'PENDING_REGISTRAR_APPROVAL']
    }),
    handleAuthorizePosting
);
router.post(
    '/postings/:id/authorize',
    enforceMakerChecker({
        entityType: 'staffPosting',
        paramKey: 'id',
        imputerField: 'imputedById',
        statusField: 'status',
        allowedStatuses: ['PENDING_REGISTRAR_AUTHORIZATION', 'PENDING_REGISTRAR_APPROVAL']
    }),
    handleAuthorizePosting
);

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

router.put(
    '/files/:id/clear',
    enforceMakerChecker({
        entityType: 'staffProfile',
        paramKey: 'id',
        imputerField: 'createdById',
        statusField: 'accountStatus',
        allowedStatuses: ['PENDING_REGISTRAR_CLEARANCE']
    }),
    handleClearFile
);
router.post(
    '/files/:id/clear',
    enforceMakerChecker({
        entityType: 'staffProfile',
        paramKey: 'id',
        imputerField: 'createdById',
        statusField: 'accountStatus',
        allowedStatuses: ['PENDING_REGISTRAR_CLEARANCE']
    }),
    handleClearFile
);

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
 * GET /api/v1/registrar/role-changes/pending
 * List all staff role modifications awaiting Registrar authorization.
 */
router.get('/role-changes/pending', async (req: Request, res: Response) => {
    try {
        const pending = await prisma.user.findMany({
            where: {
                roleChangeStatus: 'PENDING_REGISTRAR_APPROVAL'
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                pendingRole: true,
                roleChangeStatus: true,
                roleChangeRequestedById: true,
                roleChangeRequestedAt: true,
                roleChangeRemarks: true,
                staffProfile: {
                    select: {
                        id: true,
                        staffId: true,
                        surname: true,
                        otherNames: true,
                        rank: true,
                        level: true,
                        cadre: true,
                        passportUrl: true,
                        unit: { select: { id: true, name: true } },
                        studyCenter: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: { roleChangeRequestedAt: 'desc' }
        });

        const requesterIds = Array.from(new Set(pending.map(u => u.roleChangeRequestedById).filter(Boolean))) as string[];
        const requesters = await prisma.user.findMany({
            where: { id: { in: requesterIds } },
            select: { id: true, name: true, email: true, role: true }
        });
        const requesterMap = new Map(requesters.map(r => [r.id, r]));

        const enriched = pending.map(u => ({
            ...u,
            requestedBy: u.roleChangeRequestedById ? requesterMap.get(u.roleChangeRequestedById) : null
        }));

        res.json(enriched);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch pending role changes', error: error.message });
    }
});

/**
 * POST /api/v1/registrar/role-changes/:userId/authorize
 * Authorize a pending role modification with digital signature.
 */
router.post('/role-changes/:userId/authorize', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const authorizerId = (req as any).user?.id;
        const authorizerRole = (req as any).user?.role;
        const { remarks } = req.body;

        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            include: { staffProfile: true }
        });

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (targetUser.roleChangeStatus !== 'PENDING_REGISTRAR_APPROVAL' || !targetUser.pendingRole) {
            return res.status(400).json({ message: 'No pending role change request found for this user.' });
        }

        validateDualControlSelfAuthorization(targetUser.roleChangeRequestedById, authorizerId);

        const oldRole = targetUser.role;
        const approvedRole = targetUser.pendingRole;

        const payload = `ROLE_AUTH:${userId}:${oldRole}:${approvedRole}:${authorizerId}:${Date.now()}`;
        const digitalStamp = crypto.createHash('sha256').update(payload).digest('hex');

        let updatedRank = targetUser.staffProfile?.rank;
        if (approvedRole === Role.REGISTRAR) {
            updatedRank = 'University Registrar';
        } else if (approvedRole === Role.VICE_CHANCELLOR) {
            updatedRank = 'Vice-Chancellor';
        }

        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: {
                    role: approvedRole,
                    pendingRole: null,
                    roleChangeStatus: 'APPROVED'
                }
            });

            if (targetUser.staffProfile && updatedRank && updatedRank !== targetUser.staffProfile.rank) {
                await tx.staffProfile.update({
                    where: { id: targetUser.staffProfile.id },
                    data: { rank: updatedRank }
                });
            }

            await tx.authorizationAuditTrail.create({
                data: {
                    entityType: AuthorizationEntityType.ROLE_CHANGE,
                    entityId: userId,
                    imputerId: targetUser.roleChangeRequestedById || authorizerId,
                    imputerIp: '0.0.0.0',
                    authorizerId,
                    authorizerIp: req.ip,
                    authorizedAt: new Date(),
                    actionTaken: AuthorizationActionTaken.APPROVED,
                    remarks: remarks || `Role transition to ${approvedRole} authorized by Registrar`,
                    digitalStampRef: digitalStamp,
                    metadata: {
                        oldRole,
                        newRole: approvedRole,
                        approvedByRole: authorizerRole
                    }
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: authorizerId,
                    action: 'ROLE_CHANGE_AUTHORIZED',
                    resource: `User:${userId}`,
                    details: `Role change from ${oldRole} to ${approvedRole} authorized by Registrar. Stamp: ${digitalStamp}`
                }
            });
        });

        // Notify
        if (targetUser.roleChangeRequestedById) {
            await prisma.notification.create({
                data: {
                    userId: targetUser.roleChangeRequestedById,
                    title: 'Role Authorization Completed',
                    message: `Role change for ${targetUser.name || targetUser.email} to ${approvedRole} was authorized by Registrar.`,
                    type: 'ROLE_CHANGE_APPROVED'
                }
            }).catch(() => {});
        }

        res.json({
            message: `Role change to ${approvedRole} authorized successfully.`,
            newRole: approvedRole,
            digitalStamp
        });
    } catch (error: any) {
        console.error('Role change authorization error:', error);
        res.status(500).json({ message: error.message || 'Failed to authorize role change' });
    }
});

/**
 * POST /api/v1/registrar/role-changes/:userId/reject
 * Reject a pending role modification with remarks.
 */
router.post('/role-changes/:userId/reject', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const authorizerId = (req as any).user?.id;
        const authorizerRole = (req as any).user?.role;
        const { remarks } = req.body;

        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (targetUser.roleChangeStatus !== 'PENDING_REGISTRAR_APPROVAL') {
            return res.status(400).json({ message: 'No pending role change request found for this user.' });
        }

        const pendingRole = targetUser.pendingRole;

        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: {
                    pendingRole: null,
                    roleChangeStatus: 'REJECTED',
                    roleChangeRemarks: remarks || 'Rejected by Registrar'
                }
            });

            await tx.authorizationAuditTrail.create({
                data: {
                    entityType: AuthorizationEntityType.ROLE_CHANGE,
                    entityId: userId,
                    imputerId: targetUser.roleChangeRequestedById || authorizerId,
                    imputerIp: '0.0.0.0',
                    authorizerId,
                    authorizerIp: req.ip,
                    authorizedAt: new Date(),
                    actionTaken: AuthorizationActionTaken.REJECTED,
                    remarks: remarks || 'Role change rejected by Registrar',
                    metadata: {
                        rejectedRole: pendingRole,
                        currentRole: targetUser.role
                    }
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: authorizerId,
                    action: 'ROLE_CHANGE_REJECTED',
                    resource: `User:${userId}`,
                    details: `Role change to ${pendingRole} rejected by Registrar. Remarks: ${remarks || 'None'}`
                }
            });
        });

        res.json({ message: 'Role change rejected successfully.', status: 'REJECTED' });
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to reject role change' });
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

/**
 * GET /api/v1/registrar/confirmations/pending
 * Executive docket for pending confirmation ratifications (2-year rule, 3-year hard drop, and HR Staged Dossiers)
 */
router.get('/confirmations/pending', async (req: Request, res: Response) => {
    try {
        const staffList = await prisma.staffProfile.findMany({
            where: {
                isDeleted: false,
                OR: [
                    { confirmationStaged: true },
                    {
                        confirmationStatus: {
                            in: ['ON_PROBATION', 'PROBATION_EXTENDED', 'TERMINATION_RECOMMENDED']
                        }
                    }
                ]
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                unit: { select: { id: true, name: true } },
                studyCenter: { select: { id: true, name: true } }
            },
            orderBy: [
                { confirmationStaged: 'desc' },
                { probationStartDate: 'asc' }
            ]
        });

        const now = new Date().getTime();
        const formatted = staffList.map(s => {
            const start = s.probationStartDate ? new Date(s.probationStartDate).getTime() : (s.dateOfFirstAppointment ? new Date(s.dateOfFirstAppointment).getTime() : now);
            const elapsedMonths = Math.floor((now - start) / (30.4375 * 24 * 60 * 60 * 1000));
            return {
                ...s,
                monthsOnProbation: elapsedMonths,
                isDueForAppraisal: elapsedMonths >= 24,
                isHardDropThresholdExceeded: elapsedMonths >= 36
            };
        });

        res.json(formatted);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch pending confirmations', error: error.message });
    }
});

/**
 * POST /api/v1/registrar/confirmations/:staffProfileId/ratify
 * PUT /api/v1/registrar/confirmations/:staffProfileId/ratify
 * Registrar ratifies confirmation: CONFIRMED, PROBATION_EXTENDED (6/12 mos), or TERMINATION_RECOMMENDED
 */
const handleRatifyConfirmation = async (req: Request, res: Response) => {
    try {
        const { staffProfileId } = req.params;
        const { decision, remarks } = req.body;
        // @ts-ignore
        const authorizerId = req.user?.id;

        if (!decision || !['CONFIRMED', 'PROBATION_EXTENDED', 'TERMINATION_RECOMMENDED'].includes(decision)) {
            return res.status(400).json({ message: "Decision must be 'CONFIRMED', 'PROBATION_EXTENDED', or 'TERMINATION_RECOMMENDED'" });
        }

        const result = await ProbationConfirmationService.ratifyConfirmation(
            staffProfileId,
            authorizerId,
            decision as any,
            remarks
        );

        res.json({
            message: `Staff appointment successfully updated to ${decision}.`,
            result
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to ratify confirmation', error: error.message });
    }
};

router.post('/confirmations/:staffProfileId/ratify', handleRatifyConfirmation);
router.put('/confirmations/:staffProfileId/ratify', handleRatifyConfirmation);

/**
 * POST /api/v1/registrar/discipline/sanction
 * Registrar executes Disciplinary Suspension or Interdiction with 50% pay reduction schedule
 */
router.post('/discipline/sanction', async (req: Request, res: Response) => {
    try {
        const { staffProfileId, sanctionType, remarks } = req.body;
        // @ts-ignore
        const authorizerId = req.user?.id;

        if (!staffProfileId || !sanctionType || !['SUSPENDED', 'INTERDICTED'].includes(sanctionType)) {
            return res.status(400).json({ message: "staffProfileId and sanctionType ('SUSPENDED' | 'INTERDICTED') are required" });
        }

        const result = await DisciplinaryPayrollService.applySanction(
            staffProfileId,
            sanctionType,
            authorizerId,
            remarks
        );

        res.json({
            message: `Disciplinary sanction ${sanctionType} successfully executed. Statutory 50% salary reduction scheduled.`,
            result
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to execute disciplinary sanction', error: error.message });
    }
});

/**
 * POST /api/v1/registrar/discipline/verdict
 * Registrar executes Case Verdict: EXONERATED (refunds arrears batch), DISMISSED/CONVICTED (forfeits), COMPASSIONATE_GROUNDS
 */
router.post('/discipline/verdict', async (req: Request, res: Response) => {
    try {
        const { staffProfileId, verdict, reference } = req.body;
        // @ts-ignore
        const authorizerId = req.user?.id;

        if (!staffProfileId || !verdict || !['EXONERATED', 'DISMISSED', 'CONVICTED', 'COMPASSIONATE_GROUNDS'].includes(verdict)) {
            return res.status(400).json({ message: "staffProfileId and verdict ('EXONERATED' | 'DISMISSED' | 'CONVICTED' | 'COMPASSIONATE_GROUNDS') are required" });
        }

        const result = await DisciplinaryPayrollService.resolveVerdict(
            staffProfileId,
            verdict,
            authorizerId,
            reference
        );

        res.json({
            message: `Disciplinary verdict ${verdict} executed successfully.`,
            result
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to execute disciplinary verdict', error: error.message });
    }
});

/**
 * GET /api/v1/registrar/bonds/active
 * Registrar views active training bonds
 */
router.get('/bonds/active', async (req: Request, res: Response) => {
    try {
        const bonds = await prisma.trainingBondRecord.findMany({
            include: {
                staffProfile: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                        unit: { select: { name: true } },
                        studyCenter: { select: { name: true } }
                    }
                }
            },
            orderBy: { bondEndDate: 'asc' }
        });

        res.json(bonds);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch training bonds', error: error.message });
    }
});

/**
 * POST /api/v1/registrar/bonds/:id/discharge
 * Registrar authorizes bond discharge
 */
router.post('/bonds/:id/discharge', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;
        // @ts-ignore
        const authorizerId = req.user?.id;

        const bond = await TrainingBondGuard.dischargeBond(id, authorizerId, remarks);

        res.json({
            message: 'Training service bond successfully discharged.',
            bond
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to discharge training bond', error: error.message });
    }
});

export default router;
