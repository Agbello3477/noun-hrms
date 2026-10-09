import { Router, Request, Response } from 'express';
import { verifyToken } from '../../middleware/auth.middleware';
import { requireImputerRole, Permission, requirePermission } from '../../middleware/rbac.middleware';
import prisma from '../../prisma';
import { Role, TransferStatus, StaffStatus, ResettlementBursaryStatus } from '@prisma/client';
import { calculateNextPromotionMaturity } from '../../utils/promotionCalculator';
import { cacheInvalidationService } from '../../services/cacheInvalidationService';
import { PostingAllowanceEngine } from '../../services/PostingAllowanceEngine';
import { SpousalDeploymentGuard } from '../../services/SpousalDeploymentGuard';
import { ProbationConfirmationService } from '../../services/ProbationConfirmationService';
import { TrainingBondGuard } from '../../services/TrainingBondGuard';
import bcrypt from 'bcryptjs';

const router = Router();

// Apply Authentication to all Imputer routes
router.use(verifyToken);

/**
 * POST /api/v1/registry/postings/draft
 * Imputer drafts a new staff posting/transfer order.
 * Strictly prohibited for Registrar / Authorizer accounts.
 */
router.post('/postings/draft', requirePermission(Permission.CAN_IMPUTE_POSTING), async (req: Request, res: Response) => {
    try {
        const {
            staffId,
            toCenterId,
            toUnitId,
            reason,
            effectiveDate,
            relocationAllowance = false,
            relocationAllowanceAmount = 0,
            isManagementInitiated = true,
            spousalConflictVcApprovalUrl = null
        } = req.body;

        // @ts-ignore
        const imputerId = req.user?.id;

        // 1. Locate staff member
        const staff = await prisma.staffProfile.findFirst({
            where: {
                OR: [
                    { id: staffId },
                    { userId: staffId },
                    { staffId: staffId }
                ],
                isDeleted: false
            },
            include: { user: true, studyCenter: true, unit: true, spouse: true }
        });

        if (!staff) {
            return res.status(404).json({ message: 'Staff profile not found' });
        }

        const oldCenter = staff.studyCenter?.name || staff.unit?.name || 'Unassigned';
        const oldUnitId = staff.unitId || null;
        const oldCenterId = staff.centerId || null;

        // 2. Resolve destination
        let newUnitId: string | null = null;
        let newCenterId: string | null = null;
        let destinationName = '';

        if (toUnitId) {
            const u = await prisma.unit.findUnique({ where: { id: toUnitId } });
            if (!u) return res.status(404).json({ message: 'Target Unit / Directorate not found' });
            newUnitId = u.id;
            destinationName = u.name;
        } else if (toCenterId) {
            const c = await prisma.studyCenter.findUnique({ where: { id: toCenterId } });
            if (!c) return res.status(404).json({ message: 'Target Study Center not found' });
            newCenterId = c.id;
            destinationName = c.name;
        } else {
            return res.status(400).json({ message: 'Target Destination (Unit or Study Center) is required' });
        }

        // 3. Spousal Co-Location Deployment Conflict Guard Check
        const spousalCheck = await SpousalDeploymentGuard.checkConflict({
            staffProfileId: staff.id,
            targetUnitId: newUnitId,
            targetCenterId: newCenterId,
            vcApprovalUrl: spousalConflictVcApprovalUrl
        });

        // 4. Calculate 2% Resettlement Allowance if Management-Initiated
        const isMgmt = isManagementInitiated === true || isManagementInitiated === 'true';
        const allowanceCalc = await PostingAllowanceEngine.calculateAllowance(staff.id, isMgmt);

        // 5. Create TransferLog with PENDING_REGISTRAR_APPROVAL status and imputer stamp
        const posting = await prisma.transferLog.create({
            data: {
                staffId: staff.user.id,
                initiatedById: imputerId,
                oldUnitId,
                oldCenterId: oldCenterId || oldUnitId || 'Unassigned',
                newUnitId,
                newCenterId: newCenterId || newUnitId,
                status: TransferStatus.PENDING_REGISTRAR_APPROVAL,
                relocationAllowance: Boolean(relocationAllowance) || isMgmt,
                relocationAllowanceAmount: allowanceCalc.resettlementAllowanceAmount > 0 ? allowanceCalc.resettlementAllowanceAmount : Number(relocationAllowanceAmount || 0),
                isManagementInitiated: isMgmt,
                resettlementAllowanceAmount: allowanceCalc.resettlementAllowanceAmount,
                resettlementBursaryStatus: allowanceCalc.resettlementBursaryStatus,
                spousalConflictDetected: spousalCheck.hasConflict,
                spousalConflictVcApprovalUrl: spousalConflictVcApprovalUrl || null,
                isEffective: false,
                applied: false,
                reason: reason || (isMgmt ? 'Official Management-Directed Posting Draft' : 'Staff-Requested Transfer Draft'),
                effectiveDate: new Date(effectiveDate || Date.now())
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
                                level: true
                            }
                        }
                    }
                },
                initiatedBy: { select: { id: true, name: true, email: true, role: true } },
                oldUnit: { select: { id: true, name: true } },
                newUnit: { select: { id: true, name: true } }
            }
        });

        // Also record in staffPostings table for model synchronization
        await prisma.staffPosting.create({
            data: {
                id: posting.id,
                staffProfileId: staff.id,
                oldUnitId,
                oldCenterId,
                newUnitId,
                newCenterId,
                status: TransferStatus.PENDING_REGISTRAR_APPROVAL,
                isManagementInitiated: isMgmt,
                resettlementAllowanceAmount: allowanceCalc.resettlementAllowanceAmount,
                resettlementBursaryStatus: allowanceCalc.resettlementBursaryStatus,
                spousalConflictDetected: spousalCheck.hasConflict,
                spousalConflictVcApprovalUrl: spousalConflictVcApprovalUrl || null,
                effectiveDate: new Date(effectiveDate || Date.now()),
                reason: reason || (isMgmt ? 'Official Management-Directed Posting Draft' : 'Staff-Requested Transfer Draft'),
                initiatedById: imputerId
            }
        }).catch(() => {});

        // 6. Notify Authorizers (Registrar & Deputy Registrar)
        const authorizers = await prisma.user.findMany({
            where: {
                role: { in: [Role.REGISTRAR, Role.DEPUTY_REGISTRAR, Role.SUPER_USER] },
                isActive: true
            },
            select: { id: true }
        });

        const staffFullName = `${staff.surname || ''} ${staff.otherNames || ''}`.trim() || staff.user.name || 'Staff';
        const spousalWarningText = spousalCheck.hasConflict ? ' ⚠️ [Spousal Co-Location Warning: VC Waiver Required]' : '';

        for (const auth of authorizers) {
            await prisma.notification.create({
                data: {
                    userId: auth.id,
                    title: `📋 Draft Staff Posting Staged${spousalWarningText}`,
                    message: `Draft posting order staged for ${staffFullName} (${staff.staffId || 'N/A'}) to ${destinationName}. Resettlement 2%: ₦${allowanceCalc.resettlementAllowanceAmount.toLocaleString('en-NG')}. Requires executive authorization.`,
                    type: spousalCheck.hasConflict ? 'WARNING' : 'INFO',
                    link: '/registrar-cockpit'
                }
            }).catch(() => {});
        }

        // Invalidate staff postings docket cache
        await cacheInvalidationService.invalidateStaffPostings();

        res.status(201).json({
            message: 'Staff posting drafted successfully and staged for Registrar authorization.',
            posting: {
                ...posting,
                imputedById: posting.initiatedById,
                spousalConflict: spousalCheck,
                resettlementCalculation: allowanceCalc
            }
        });
    } catch (error: any) {
        console.error('Error drafting posting order:', error);
        res.status(500).json({ message: 'Internal server error drafting staff posting', error: error.message });
    }
});

/**
 * GET /api/v1/registry/postings/drafts
 * Retrieve all postings staged for authorization.
 */
router.get('/postings/drafts', requireImputerRole, async (req: Request, res: Response) => {
    try {
        const drafts = await prisma.transferLog.findMany({
            where: {
                status: {
                    in: [
                        TransferStatus.PENDING_REGISTRAR_APPROVAL,
                        TransferStatus.PENDING_REGISTRAR_AUTHORIZATION,
                        TransferStatus.RETURNED_FOR_REVIEW
                    ]
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

        res.json(drafts);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to retrieve drafted postings', error: error.message });
    }
});

/**
 * POST /api/v1/registry/files/initiate
 * Imputer creates a digital staff file staged for Registrar clearance.
 * Account status: PENDING_REGISTRAR_CLEARANCE, isActivated: false.
 */
router.post('/files/initiate', requirePermission(Permission.CAN_IMPUTE_STAFF_FILE), async (req: Request, res: Response) => {
    try {
        const {
            email,
            name,
            password,
            surname,
            otherNames,
            title,
            phone,
            gender,
            stateOfOrigin,
            lga,
            address,
            highestQualification,
            bankName,
            accountNumber,
            accountName,
            nin,
            passportUrl,
            role = Role.STAFF,
            cadre,
            level,
            step,
            rank,
            centerId,
            unitId,
            dateOfBirth,
            dateOfFirstAppointment,
            employmentCategory = 'PERMANENT'
        } = req.body;

        // @ts-ignore
        const imputerId = req.user?.id;

        // Validation
        if (!email || !surname || !otherNames) {
            return res.status(400).json({ message: 'Email, Surname, and Other Names are required' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const count = await prisma.staffProfile.count();
        const year = new Date().getFullYear();
        const generatedStaffId = `NOUN/${year}/${String(count + 1).padStart(4, '0')}`;
        const hashedPassword = await bcrypt.hash(password || '123456789', 10);

        const now = new Date();
        const apptDate = dateOfFirstAppointment ? new Date(dateOfFirstAppointment) : now;
        const dob = dateOfBirth ? new Date(dateOfBirth) : new Date(1990, 0, 1);

        const maturity = calculateNextPromotionMaturity({
            cadre: cadre || 'ADMINISTRATIVE',
            level: level || 'CONTISS 08',
            dateOfFirstAppointment: apptDate,
            lastPromotionDate: apptDate
        });

        const createdUser = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    email,
                    name: name || `${surname} ${otherNames}`.trim(),
                    password: hashedPassword,
                    role: (role as Role) || Role.STAFF,
                    isActive: false, // Locked until Registrar clearance
                    staffProfile: {
                        create: {
                            staffId: generatedStaffId,
                            surname,
                            otherNames,
                            title,
                            rank: rank || 'Administrative Officer',
                            highestQualification,
                            bankName,
                            accountNumber,
                            accountName,
                            nin,
                            passportUrl,
                            phone,
                            gender,
                            stateOfOrigin,
                            lga,
                            address,
                            level,
                            step,
                            cadre: cadre || 'ADMINISTRATIVE',
                            dateOfBirth: dob,
                            dateOfFirstAppointment: apptDate,
                            lastPromotionDate: maturity.lastPromotionDate,
                            nextPromotionDueYear: maturity.nextDueYear,
                            nextDueYear: maturity.nextDueYear,
                            nextPromotionDueDate: maturity.nextDueDate,
                            nextDueDate: maturity.nextDueDate,
                            promotionEligibilityStatus: maturity.eligibilityStatus,
                            eligibilityStatus: maturity.eligibilityStatus,
                            centerId: centerId || undefined,
                            unitId: unitId || undefined,
                            createdById: imputerId,
                            // Maker-Checker Clearance Gate
                            accountStatus: 'PENDING_REGISTRAR_CLEARANCE',
                            isActivated: false,
                            clearanceSubmittedAt: now,
                            employmentCategory: employmentCategory as any
                        }
                    }
                },
                include: {
                    staffProfile: true
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: imputerId,
                    action: 'INITIATE_STAFF_FILE_MAKER',
                    resource: 'STAFF_PROFILE',
                    details: JSON.stringify({ staffId: generatedStaffId, email, imputerId }),
                    ipAddress: req.ip
                }
            });

            return newUser;
        });

        // Notify Authorizers
        const registrars = await prisma.user.findMany({
            where: { role: { in: [Role.REGISTRAR, Role.DEPUTY_REGISTRAR, Role.SUPER_USER] }, isActive: true },
            select: { id: true }
        });

        for (const reg of registrars) {
            await prisma.notification.create({
                data: {
                    userId: reg.id,
                    title: '👤 New Staff File Awaiting Clearance',
                    message: `New digital staff file created for ${surname} ${otherNames} (${generatedStaffId}). Staged for Registrar clearance.`,
                    type: 'INFO',
                    link: '/registrar-cockpit'
                }
            }).catch(() => {});
        }

        await cacheInvalidationService.invalidateStaffRoster();
        await cacheInvalidationService.invalidateFileRequisitions();

        res.status(201).json({
            message: 'Staff file initiated successfully and staged for Registrar clearance.',
            staffId: generatedStaffId,
            accountStatus: 'PENDING_REGISTRAR_CLEARANCE',
            isActivated: false,
            userId: createdUser.id,
            profileId: createdUser.staffProfile?.id
        });
    } catch (error: any) {
        console.error('Error initiating staff file:', error);
        res.status(500).json({ message: 'Internal server error initiating staff file', error: error.message });
    }
});

/**
 * GET /api/v1/registry/files/drafts
 * Retrieve files currently staged for clearance.
 */
router.get('/files/drafts', requireImputerRole, async (req: Request, res: Response) => {
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
                createdBy: { select: { id: true, name: true, email: true } }
            },
            orderBy: { clearanceSubmittedAt: 'desc' }
        });

        res.json(files);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch staged files', error: error.message });
    }
});

/**
 * POST /api/v1/registry/promotions/request-override
 * Imputer stages a promotion override for executive approval.
 */
router.post('/promotions/request-override', requirePermission(Permission.CAN_REQUEST_PROMOTION_OVERRIDE), async (req: Request, res: Response) => {
    try {
        const { staffProfileId, requestedDueYear, justification } = req.body;
        // @ts-ignore
        const imputerId = req.user?.id;

        if (!staffProfileId || !requestedDueYear || !justification || justification.trim().length < 5) {
            return res.status(400).json({ message: 'Staff ID, requested due year, and justification note (min 5 chars) are required.' });
        }

        const profile = await prisma.staffProfile.findUnique({
            where: { id: staffProfileId },
            include: { user: true }
        });

        if (!profile) {
            return res.status(404).json({ message: 'Staff profile not found' });
        }

        const updated = await prisma.staffProfile.update({
            where: { id: staffProfileId },
            data: {
                promotionOverrideStatus: 'PENDING_REGISTRAR_OVERRIDE',
                requestedPromotionDueYear: parseInt(requestedDueYear, 10),
                promotionOverrideJustification: justification.trim(),
                promotionOverrideRequestedById: imputerId,
                promotionOverrideRequestedAt: new Date()
            }
        });

        // Notify Authorizers
        const registrars = await prisma.user.findMany({
            where: { role: { in: [Role.REGISTRAR, Role.DEPUTY_REGISTRAR, Role.SUPER_USER] }, isActive: true },
            select: { id: true }
        });

        for (const reg of registrars) {
            await prisma.notification.create({
                data: {
                    userId: reg.id,
                    title: '📈 Promotion Override Request',
                    message: `Promotion override requested for ${profile.user.name} (${profile.staffId}) to year ${requestedDueYear}. Requires Registrar approval.`,
                    type: 'INFO',
                    link: '/registrar-cockpit'
                }
            }).catch(() => {});
        }

        await cacheInvalidationService.invalidatePromotions();

        res.json({
            message: 'Promotion override request staged for Registrar review.',
            profile: updated
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to stage promotion override', error: error.message });
    }
});

/**
 * POST /api/v1/registry/queries/issue
 * Imputer issues or drafts a query to a staff member.
 */
router.post('/queries/issue', requirePermission(Permission.CAN_ISSUE_DISCIPLINARY_QUERY), async (req: Request, res: Response) => {
    try {
        const { staffId, title, content } = req.body;
        // @ts-ignore
        const imputerId = req.user?.id;

        if (!staffId || !title || !content) {
            return res.status(400).json({ message: 'Staff ID, title, and query content are required' });
        }

        const targetProfile = await prisma.staffProfile.findFirst({
            where: { OR: [{ id: staffId }, { userId: staffId }, { staffId: staffId }] }
        });

        if (!targetProfile) {
            return res.status(404).json({ message: 'Target staff not found' });
        }

        const query = await prisma.staffQuery.create({
            data: {
                staffId: targetProfile.id,
                issuedById: imputerId,
                title,
                content,
                status: 'OPEN',
                source: 'REGISTRY'
            }
        });

        res.status(201).json({
            message: 'Disciplinary query issued successfully.',
            query
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to issue query', error: error.message });
    }
});

/**
 * GET /api/v1/registry/confirmations/due
 * Imputer views staff due for confirmation appraisal or 3-year review
 */
router.get('/confirmations/due', async (req: Request, res: Response) => {
    try {
        const staffList = await prisma.staffProfile.findMany({
            where: {
                isDeleted: false,
                confirmationStatus: {
                    in: ['ON_PROBATION', 'PROBATION_EXTENDED', 'TERMINATION_RECOMMENDED']
                }
            },
            include: {
                user: { select: { name: true, email: true } },
                unit: { select: { id: true, name: true } },
                studyCenter: { select: { id: true, name: true } }
            },
            orderBy: { probationStartDate: 'asc' }
        });

        const now = new Date().getTime();
        const formatted = staffList.map(s => {
            const start = s.probationStartDate ? new Date(s.probationStartDate).getTime() : now;
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
        res.status(500).json({ message: 'Failed to fetch probation list', error: error.message });
    }
});

/**
 * POST /api/v1/registry/confirmations/draft
 * Imputer compiles and stages a confirmation dossier to Registrar
 */
router.post('/confirmations/draft', async (req: Request, res: Response) => {
    try {
        const { staffProfileId, recommendation, remarks, appraisalScore } = req.body;
        // @ts-ignore
        const imputerId = req.user?.id;

        const staff = await prisma.staffProfile.findUnique({
            where: { id: staffProfileId },
            include: { user: true }
        });

        if (!staff) {
            return res.status(404).json({ message: 'Staff profile not found' });
        }

        // Notify Registrar
        const registrars = await prisma.user.findMany({
            where: { role: { in: [Role.REGISTRAR, Role.DEPUTY_REGISTRAR, Role.SUPER_USER] }, isActive: true },
            select: { id: true }
        });

        const staffName = `${staff.surname || ''} ${staff.otherNames || ''}`.trim() || staff.user.name || 'Staff';
        for (const reg of registrars) {
            await prisma.notification.create({
                data: {
                    userId: reg.id,
                    title: '📋 Confirmation File Staged',
                    message: `Confirmation appraisal dossier compiled and staged for ${staffName} (${staff.staffId || 'N/A'}). Recommendation: ${recommendation || 'CONFIRM'}.`,
                    type: 'INFO',
                    link: '/registrar-cockpit'
                }
            }).catch(() => {});
        }

        res.json({
            message: 'Confirmation appraisal dossier compiled and staged for Registrar ratification.',
            staffProfileId,
            recommendation,
            imputedById: imputerId,
            stagedAt: new Date()
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to stage confirmation file', error: error.message });
    }
});

/**
 * POST /api/v1/registry/bonds/log
 * Imputer logs verified training costs and computes bond expiry
 */
router.post('/bonds/log', async (req: Request, res: Response) => {
    try {
        const { staffProfileId, trainingType, studyDurationYears, totalFinancialIndemnity, bondStartDate } = req.body;

        if (!staffProfileId || !trainingType || !studyDurationYears) {
            return res.status(400).json({ message: 'staffProfileId, trainingType, and studyDurationYears are required' });
        }

        const bond = await TrainingBondGuard.createBondRecord({
            staffProfileId,
            trainingType,
            studyDurationYears: Number(studyDurationYears),
            totalFinancialIndemnity: Number(totalFinancialIndemnity || 0),
            bondStartDate: bondStartDate ? new Date(bondStartDate) : new Date()
        });

        res.status(201).json({
            message: 'Training service bond logged successfully.',
            bond
        });
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to log training bond', error: error.message });
    }
});

/**
 * GET /api/v1/registry/bonds
 * Imputer views active training bond records
 */
router.get('/bonds', async (req: Request, res: Response) => {
    try {
        const bonds = await prisma.trainingBondRecord.findMany({
            include: {
                staffProfile: {
                    include: {
                        user: { select: { name: true, email: true } },
                        unit: { select: { name: true } },
                        studyCenter: { select: { name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(bonds);
    } catch (error: any) {
        res.status(500).json({ message: 'Failed to fetch training bonds', error: error.message });
    }
});

export default router;
