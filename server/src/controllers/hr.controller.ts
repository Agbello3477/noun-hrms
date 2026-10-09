import { Request, Response } from 'express';
import { Role, User, Cadre, CadreType, EmploymentCategory, PromotionEligibilityStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { StorageService } from '../services/storage.service';
import { sendAccountCreatedNotification } from '../services/email.service';
import { redisService } from '../services/redis.service';
import { calculateNextPromotionMaturity } from '../utils/promotionCalculator';
import { calculateStatutoryRetirementDate } from '../utils/retirement';
import { resolveCadre, resolveCadreType } from '../utils/cadreResolver';
import { notifyUser } from './notification.controller';

// Helper to generate next Staff ID
const generateStaffId = async (): Promise<string> => {
    return await prisma.$transaction(async (tx) => {
        let seq = await tx.systemSequence.findUnique({ where: { key: 'STAFF_ID' } });

        if (!seq) {
            seq = await tx.systemSequence.create({ data: { key: 'STAFF_ID', current: 1000 } });
        } else {
            seq = await tx.systemSequence.update({
                where: { key: 'STAFF_ID' },
                data: { current: { increment: 1 } }
            });
        }

        return `NOUN/${String(seq.current).padStart(5, '0')}`;
    });
};

export const createStaffFile = async (req: Request, res: Response) => {
    try {
        const {
            email, name, password,
            surname, otherNames, title, phone, gender,
            stateOfOrigin, lga, address,
            highestQualification,
            bankName, accountNumber, accountName,
            nin, passportUrl,
            role, cadre, level, step, rank,
            centerId, unitId,
            programmeId, facilitatorInfo,
            dateOfBirth, dateOfFirstAppointment,
            lastPromotionDate,
            nextPromotionDueYear,
            nextPromotionDueDate,
            isDueImmediately,
            overrideReason,
            // Diversified Onboarding Fields
            employmentCategory = EmploymentCategory.PERMANENT,
            contractStartDate, contractEndDate, contractRenewalTerms, specialAllowanceStructure,
            callUpNumber, stateCode, primaryAssignmentDepartment, serviceYearBatch, nyscPPAAllowance, passOutDate,
            volunteerProgramName, honorariumAmount, engagementDurationMonths, mouReferenceNumber
        } = req.body;

        if (!email) return res.status(400).json({ message: 'Email is required' });
        const normalizedEmail = email.trim().toLowerCase();

        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) return res.status(400).json({ message: 'Staff file with this email already exists. To recreate it, the existing file must first be deleted by HR.' });

        if (!stateOfOrigin || !lga) {
            return res.status(400).json({ message: 'State of Origin and LGA are required.' });
        }

        if (phone) {
            const existingPhone = await prisma.staffProfile.findFirst({ where: { phone } });
            if (existingPhone) {
                return res.status(400).json({ message: 'Staff file with this phone number already exists. To recreate it, the existing file must first be deleted by HR.' });
            }
        }

        if (surname && otherNames) {
            const existingName = await prisma.staffProfile.findFirst({
                where: {
                    surname: { equals: surname.trim(), mode: 'insensitive' },
                    otherNames: { equals: otherNames.trim(), mode: 'insensitive' }
                }
            });
            if (existingName) {
                return res.status(400).json({ message: 'Staff file with this name already exists. To recreate it, the existing file must first be deleted by HR.' });
            }
        }

        const staffId = await generateStaffId();
        const defaultPassword = password || '123456789';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        let resolvedRole: Role = Role.STAFF;
        let resolvedRank: string | undefined = rank;
        if (role === 'DIRECTOR') {
            resolvedRole = Role.UNIT_HEAD;
            if (!resolvedRank) resolvedRank = 'Director';
        } else if (role === 'DEAN') {
            resolvedRole = Role.UNIT_HEAD;
            if (!resolvedRank) resolvedRank = 'Dean';
        } else if (role === 'UNIT_HEAD') {
            resolvedRole = Role.UNIT_HEAD;
            if (!resolvedRank) resolvedRank = 'Head of Unit';
        } else if (role === 'HEAD_OF_ADMIN') {
            resolvedRole = Role.UNIT_ADMIN;
            if (!resolvedRank) resolvedRank = 'Head of Admin';
        } else if (role && Object.values(Role).includes(role as any)) {
            resolvedRole = role as Role;
        }
        const resolvedCadre = resolveCadre(cadre);
        const resolvedCadreType = resolveCadreType(cadre);

        // @ts-ignore
        const currentUserId = req.user?.id;

        const parseDate = (val: any) => {
            if (!val || val === 'null' || val === '') return null;
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        };

        const dob = parseDate(dateOfBirth);
        const apptDate = parseDate(dateOfFirstAppointment);
        const lastPromoDate = parseDate(lastPromotionDate);

        // Calculate statutory retirement date and trigger factor
        let statutoryRetirementDate: Date | null = null;
        let statutoryRetirementReason: string | null = null;
        if (dob) {
            const retResult = calculateStatutoryRetirementDate(dob, apptDate, resolvedRank, resolvedCadre);
            statutoryRetirementDate = retResult.retirementDate;
            statutoryRetirementReason = retResult.reason;
        }

        // Calculate statutory next promotion maturity
        const maturity = calculateNextPromotionMaturity({
            cadre: resolvedCadre,
            level,
            dateOfFirstAppointment: apptDate,
            lastPromotionDate: lastPromoDate,
            overrideDueYear: nextPromotionDueYear ? parseInt(String(nextPromotionDueYear), 10) : undefined,
            overrideDueDate: nextPromotionDueDate ? new Date(nextPromotionDueDate) : undefined,
            overrideReason: overrideReason || undefined,
            isDueImmediately: Boolean(isDueImmediately)
        });

        let effectivePassportUrl = (passportUrl || req.body.passport || req.body.passportPreview) ? String(passportUrl || req.body.passport || req.body.passportPreview).trim() : undefined;
        if (req.file) {
            effectivePassportUrl = await StorageService.uploadFile(req.file);
        }

        const resolvedEmploymentCategory = Object.values(EmploymentCategory).includes(employmentCategory as any)
            ? (employmentCategory as EmploymentCategory)
            : EmploymentCategory.PERMANENT;

        const now = new Date();

        await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: normalizedEmail,
                    password: hashedPassword,
                    name: name || `${surname} ${otherNames}`.trim(),
                    role: resolvedRole,
                    isActive: false, // Inactive until Registrar clearance!
                    mustChangePassword: true,
                    staffProfile: {
                        create: {
                            surname, otherNames, title,
                            staffId, rank: resolvedRank,
                            highestQualification: highestQualification ? String(highestQualification).trim() : undefined,
                            bankName: bankName ? String(bankName).trim() : undefined,
                            accountNumber: accountNumber ? String(accountNumber).trim() : undefined,
                            accountName: accountName ? String(accountName).trim() : undefined,
                            nin: nin ? String(nin).trim() : undefined,
                            passportUrl: effectivePassportUrl,
                            phone, gender, stateOfOrigin, lga, address,
                            level, step,
                            cadre: resolvedCadre,
                            cadreType: resolvedCadreType,
                            dateOfBirth: dob,
                            dateOfFirstAppointment: apptDate,
                            statutoryRetirementDate,
                            statutoryRetirementReason,
                            lastPromotionDate: maturity.lastPromotionDate,
                            nextPromotionDueYear: maturity.nextDueYear,
                            nextDueYear: maturity.nextDueYear,
                            nextPromotionDueDate: maturity.nextDueDate,
                            nextDueDate: maturity.nextDueDate,
                            promotionEligibilityStatus: maturity.eligibilityStatus,
                            eligibilityStatus: maturity.eligibilityStatus,
                            legacyDataBackfilled: true,
                            centerId: centerId || undefined,
                            unitId: unitId || undefined,
                            programmeId: programmeId || undefined,
                            facilitatorInfo: facilitatorInfo || undefined,
                            createdById: currentUserId,
                            // Maker-Checker Clearance Gate
                            accountStatus: 'PENDING_REGISTRAR_CLEARANCE',
                            isActivated: false,
                            clearanceSubmittedAt: now,
                            // Diversified Onboarding Fields
                            employmentCategory: resolvedEmploymentCategory,
                            contractStartDate: parseDate(contractStartDate),
                            contractEndDate: parseDate(contractEndDate),
                            contractRenewalTerms: contractRenewalTerms || null,
                            specialAllowanceStructure: specialAllowanceStructure || undefined,
                            callUpNumber: callUpNumber || null,
                            stateCode: stateCode || null,
                            primaryAssignmentDepartment: primaryAssignmentDepartment || null,
                            serviceYearBatch: serviceYearBatch || null,
                            nyscPPAAllowance: nyscPPAAllowance ? Number(nyscPPAAllowance) : null,
                            passOutDate: parseDate(passOutDate),
                            volunteerProgramName: volunteerProgramName || null,
                            honorariumAmount: honorariumAmount ? Number(honorariumAmount) : null,
                            engagementDurationMonths: engagementDurationMonths ? Number(engagementDurationMonths) : null,
                            mouReferenceNumber: mouReferenceNumber || null
                        }
                    }
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: currentUserId,
                    action: 'CREATE_FILE_STAGED_FOR_CLEARANCE',
                    resource: 'STAFF',
                    details: JSON.stringify({ newStaffId: staffId, name: user.name, employmentCategory: resolvedEmploymentCategory }),
                    ipAddress: req.ip
                }
            });
        });

        // Notify Registrar of pending clearance
        const registrars = await prisma.user.findMany({
            where: { role: { in: [Role.REGISTRAR, Role.SUPER_USER] }, isActive: true },
            select: { id: true }
        });

        for (const reg of registrars) {
            await prisma.notification.create({
                data: {
                    userId: reg.id,
                    title: '👤 New Staff File Awaiting Clearance',
                    message: `New staff profile created for ${surname} ${otherNames} (${staffId}) [${resolvedEmploymentCategory}]. Requires Registrar clearance before account activation.`,
                    type: 'INFO',
                    link: '/dashboard/registry/files'
                }
            });
        }

        res.status(201).json({
            message: 'Staff file created and staged for official Registrar clearance.',
            staffId,
            accountStatus: 'PENDING_REGISTRAR_CLEARANCE'
        });
    } catch (error: any) {
        console.error('Create Staff File Error', error);
        res.status(500).json({ message: 'Internal server error creating staff file', error: error.message });
    }
};

export const addExistingFile = async (req: Request, res: Response) => {
    try {
        const {
            email, name, password,
            surname, otherNames, title, phone, gender,
            stateOfOrigin, lga, address,
            highestQualification,
            bankName, accountNumber, accountName,
            nin, passportUrl,
            role, cadre, level, step, rank,
            centerId, unitId,
            programmeId, facilitatorInfo,
            manualStaffId,
            dateOfBirth, dateOfFirstAppointment,
            lastPromotionDate,
            nextPromotionDueYear,
            nextPromotionDueDate,
            isDueImmediately,
            overrideReason,
            // Diversified Onboarding Fields
            employmentCategory = EmploymentCategory.PERMANENT,
            contractStartDate, contractEndDate, contractRenewalTerms,
            callUpNumber, stateCode, primaryAssignmentDepartment, serviceYearBatch, nyscPPAAllowance, passOutDate,
            volunteerProgramName, honorariumAmount, engagementDurationMonths, mouReferenceNumber
        } = req.body;

        if (!email) return res.status(400).json({ message: 'Email is required' });
        const normalizedEmail = email.trim().toLowerCase();

        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) return res.status(400).json({ message: 'Staff file with this email already exists. To recreate it, the existing file must first be deleted by HR.' });

        if (!stateOfOrigin || !lga) {
            return res.status(400).json({ message: 'State of Origin and LGA are required.' });
        }

        let staffId = manualStaffId;
        if (!staffId) {
            staffId = await generateStaffId();
        } else {
            const checkId = await prisma.staffProfile.findUnique({ where: { staffId } });
            if (checkId) return res.status(400).json({ message: 'Staff file with this Staff ID already exists.' });
        }

        if (phone) {
            const existingPhone = await prisma.staffProfile.findFirst({ where: { phone } });
            if (existingPhone) {
                return res.status(400).json({ message: 'Staff file with this phone number already exists.' });
            }
        }

        const defaultPassword = password || '123456789';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        let resolvedRole: Role = Role.STAFF;
        let resolvedRank: string | undefined = rank;
        if (role === 'DIRECTOR') {
            resolvedRole = Role.UNIT_HEAD;
            if (!resolvedRank) resolvedRank = 'Director';
        } else if (role === 'DEAN') {
            resolvedRole = Role.UNIT_HEAD;
            if (!resolvedRank) resolvedRank = 'Dean';
        } else if (role === 'UNIT_HEAD') {
            resolvedRole = Role.UNIT_HEAD;
            if (!resolvedRank) resolvedRank = 'Head of Unit';
        } else if (role === 'HEAD_OF_ADMIN') {
            resolvedRole = Role.UNIT_ADMIN;
            if (!resolvedRank) resolvedRank = 'Head of Admin';
        } else if (role && Object.values(Role).includes(role as any)) {
            resolvedRole = role as Role;
        }
        const resolvedCadre = resolveCadre(cadre);
        const resolvedCadreType = resolveCadreType(cadre);
        // @ts-ignore
        const currentUserId = req.user?.id;

        const parseDate = (val: any) => {
            if (!val || val === 'null' || val === '') return null;
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        };

        const dob = parseDate(dateOfBirth);
        const apptDate = parseDate(dateOfFirstAppointment);
        const lastPromoDate = parseDate(lastPromotionDate);

        let statutoryRetirementDate: Date | null = null;
        let statutoryRetirementReason: string | null = null;
        if (dob) {
            const retResult = calculateStatutoryRetirementDate(dob, apptDate, resolvedRank, resolvedCadre);
            statutoryRetirementDate = retResult.retirementDate;
            statutoryRetirementReason = retResult.reason;
        }

        const maturity = calculateNextPromotionMaturity({
            cadre: resolvedCadre,
            level,
            dateOfFirstAppointment: apptDate,
            lastPromotionDate: lastPromoDate,
            overrideDueYear: nextPromotionDueYear ? parseInt(String(nextPromotionDueYear), 10) : undefined,
            overrideDueDate: nextPromotionDueDate ? new Date(nextPromotionDueDate) : undefined,
            overrideReason: overrideReason || undefined,
            isDueImmediately: Boolean(isDueImmediately)
        });

        let effectivePassportUrl = (passportUrl || req.body.passport || req.body.passportPreview) ? String(passportUrl || req.body.passport || req.body.passportPreview).trim() : undefined;
        if (req.file) {
            effectivePassportUrl = await StorageService.uploadFile(req.file);
        }

        const resolvedEmploymentCategory = Object.values(EmploymentCategory).includes(employmentCategory as any)
            ? (employmentCategory as EmploymentCategory)
            : EmploymentCategory.PERMANENT;

        const now = new Date();

        await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: normalizedEmail,
                    password: hashedPassword,
                    name: name || `${surname} ${otherNames}`.trim(),
                    role: resolvedRole,
                    isActive: false, // Staged for clearance
                    mustChangePassword: true,
                    staffProfile: {
                        create: {
                            surname, otherNames, title,
                            staffId, rank: resolvedRank,
                            highestQualification: highestQualification ? String(highestQualification).trim() : undefined,
                            bankName: bankName ? String(bankName).trim() : undefined,
                            accountNumber: accountNumber ? String(accountNumber).trim() : undefined,
                            accountName: accountName ? String(accountName).trim() : undefined,
                            nin: nin ? String(nin).trim() : undefined,
                            passportUrl: effectivePassportUrl,
                            phone, gender, stateOfOrigin, lga, address,
                            level, step,
                            cadre: resolvedCadre,
                            cadreType: resolvedCadreType,
                            dateOfBirth: dob,
                            dateOfFirstAppointment: apptDate,
                            statutoryRetirementDate,
                            statutoryRetirementReason,
                            lastPromotionDate: maturity.lastPromotionDate,
                            nextPromotionDueYear: maturity.nextDueYear,
                            nextDueYear: maturity.nextDueYear,
                            nextPromotionDueDate: maturity.nextDueDate,
                            nextDueDate: maturity.nextDueDate,
                            promotionEligibilityStatus: maturity.eligibilityStatus,
                            eligibilityStatus: maturity.eligibilityStatus,
                            legacyDataBackfilled: true,
                            centerId: centerId || undefined,
                            unitId: unitId || undefined,
                            programmeId: programmeId || undefined,
                            facilitatorInfo: facilitatorInfo || undefined,
                            createdById: currentUserId,
                            accountStatus: 'PENDING_REGISTRAR_CLEARANCE',
                            isActivated: false,
                            clearanceSubmittedAt: now,
                            employmentCategory: resolvedEmploymentCategory,
                            contractStartDate: parseDate(contractStartDate),
                            contractEndDate: parseDate(contractEndDate),
                            contractRenewalTerms: contractRenewalTerms || null,
                            callUpNumber: callUpNumber || null,
                            stateCode: stateCode || null,
                            primaryAssignmentDepartment: primaryAssignmentDepartment || null,
                            serviceYearBatch: serviceYearBatch || null,
                            nyscPPAAllowance: nyscPPAAllowance ? Number(nyscPPAAllowance) : null,
                            passOutDate: parseDate(passOutDate),
                            volunteerProgramName: volunteerProgramName || null,
                            honorariumAmount: honorariumAmount ? Number(honorariumAmount) : null,
                            engagementDurationMonths: engagementDurationMonths ? Number(engagementDurationMonths) : null,
                            mouReferenceNumber: mouReferenceNumber || null
                        }
                    }
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: currentUserId,
                    action: 'ADD_EXISTING_FILE_STAGED_FOR_CLEARANCE',
                    resource: 'STAFF',
                    details: JSON.stringify({ staffId, name: user.name }),
                    ipAddress: req.ip
                }
            });
        });

        res.status(201).json({ message: 'Existing staff file staged for Registrar clearance', staffId, accountStatus: 'PENDING_REGISTRAR_CLEARANCE' });
    } catch (error: any) {
        console.error('Add Existing File Error', error);
        res.status(500).json({ message: 'Internal server error adding existing file', error: error.message });
    }
};

/**
 * GET /api/v1/registry/files/pending-clearance
 * Returns all staff files pending Registrar clearance & activation
 */
export const getPendingClearanceFiles = async (req: Request, res: Response) => {
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
        console.error('Error fetching pending clearance files:', error);
        res.status(500).json({ message: 'Failed to fetch files pending clearance' });
    }
};

/**
 * POST /api/v1/registry/files/:id/clear
 * Registrar authorizes and clears the staff file. Activates User account and triggers onboarding email.
 */
export const clearStaffFile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;
        // @ts-ignore
        const authorizerId = req.user?.id;
        // @ts-ignore
        const authorizerRole = req.user?.role;

        if (![Role.REGISTRAR, Role.SUPER_USER, Role.VICE_CHANCELLOR, Role.DEPUTY_REGISTRAR].includes(authorizerRole)) {
            return res.status(403).json({ message: 'Unauthorized: Only the Registrar can grant official staff file clearance.' });
        }

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

        const now = new Date();

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

            await tx.auditLog.create({
                data: {
                    userId: authorizerId,
                    action: 'CLEAR_STAFF_FILE',
                    resource: 'STAFF_PROFILE',
                    details: JSON.stringify({ staffProfileId: profile.id, staffId: profile.staffId, remarks }),
                    ipAddress: req.ip
                }
            });
        });

        // Send activation email with default credentials
        const staffName = profile.user.name || `${profile.surname || ''} ${profile.otherNames || ''}`.trim() || 'Staff';
        sendAccountCreatedNotification(profile.user.email, profile.phone || null, staffName, profile.staffId || 'N/A').catch(err => {
            console.error('Failed to send account creation notification on clearance:', err);
        });

        // Notify Imputer (creating HR Admin)
        if (profile.createdById) {
            await notifyUser(
                profile.createdById,
                '✅ Staff File Cleared by Registrar',
                `Staff file for ${staffName} (${profile.staffId}) has been cleared and activated.`,
                'SUCCESS',
                '/dashboard/hr/files'
            );
        }

        await Promise.all([
            redisService.clearPattern('staff:*'),
            redisService.clearPattern('analytics:*')
        ]);

        res.json({ message: 'Staff file cleared and account activated successfully.', clearedAt: now });
    } catch (error: any) {
        console.error('Error clearing staff file:', error);
        res.status(500).json({ message: 'Internal server error clearing staff file', error: error.message });
    }
};

/**
 * POST /api/v1/registry/files/:id/reject
 * Registrar rejects a staff file clearance request
 */
export const rejectStaffFile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        // @ts-ignore
        const authorizerId = req.user?.id;
        // @ts-ignore
        const authorizerRole = req.user?.role;

        if (![Role.REGISTRAR, Role.SUPER_USER, Role.VICE_CHANCELLOR, Role.DEPUTY_REGISTRAR].includes(authorizerRole)) {
            return res.status(403).json({ message: 'Unauthorized: Only the Registrar can reject staff file clearance.' });
        }

        const profile = await prisma.staffProfile.findFirst({
            where: {
                OR: [{ id }, { userId: id }, { staffId: id }]
            },
            include: { user: true }
        });

        if (!profile) return res.status(404).json({ message: 'Staff file not found' });

        await prisma.staffProfile.update({
            where: { id: profile.id },
            data: {
                accountStatus: 'REJECTED',
                clearanceRemarks: reason || 'Staff file rejected during clearance review'
            }
        });

        if (profile.createdById) {
            await notifyUser(
                profile.createdById,
                '❌ Staff File Clearance Rejected',
                `Staff file for ${profile.user.name} was rejected by the Registrar. Reason: ${reason || 'Not specified'}`,
                'ERROR',
                '/dashboard/hr/files'
            );
        }

        res.json({ message: 'Staff file clearance rejected successfully.' });
    } catch (error: any) {
        console.error('Error rejecting staff file clearance:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

export const getJobFiles = async (req: Request, res: Response) => {
    try {
        const { directorateId, centerId, facultyId } = req.query;

        const whereProfile: any = {
            isDeleted: false
        };
        if (directorateId) whereProfile.unitId = String(directorateId);
        if (centerId) whereProfile.centerId = String(centerId);
        if (facultyId) whereProfile.unitId = String(facultyId);

        const users = await prisma.user.findMany({
            where: {
                role: { not: Role.SUPER_USER },
                staffProfile: whereProfile
            },
            include: {
                staffProfile: {
                    include: {
                        createdBy: { select: { name: true, email: true } },
                        unit: true,
                        studyCenter: true,
                        queries: {
                            where: { status: 'OPEN' }
                        },
                        fileRequests: {
                            where: { status: 'APPROVED' }
                        },
                        fileRequisitions: {
                            where: {
                                status: { in: ['AUTHORIZED_BY_REGISTRAR', 'DISPATCHED_RELEASED'] }
                            },
                            select: {
                                id: true,
                                requisitionNumber: true,
                                status: true,
                                requesterDepartment: true,
                                purposeOfRequest: true,
                                urgencyLevel: true,
                                requestedFileFormat: true,
                                expectedReturnDate: true,
                                authorizedAt: true,
                                dispatchedAt: true,
                                requester: { select: { id: true, name: true, email: true, role: true } }
                            }
                        },
                        leaves: {
                            where: { status: 'APPROVED' }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(users);
    } catch (error) {
        console.error('Get Job Files Error', error);
        res.status(500).json({ message: 'Error fetching files' });
    }
};

export const getStaffFile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const profile = await prisma.staffProfile.findFirst({
            where: {
                OR: [
                    { id },
                    { userId: id },
                    { staffId: id }
                ],
                isDeleted: false
            },
            include: {
                user: true,
                unit: true,
                studyCenter: true,
                createdBy: { select: { name: true } },
                fileRequisitions: {
                    where: {
                        status: { in: ['AUTHORIZED_BY_REGISTRAR', 'DISPATCHED_RELEASED'] }
                    },
                    select: {
                        id: true,
                        requisitionNumber: true,
                        status: true,
                        requesterDepartment: true,
                        purposeOfRequest: true,
                        urgencyLevel: true,
                        requestedFileFormat: true,
                        expectedReturnDate: true,
                        authorizedAt: true,
                        dispatchedAt: true,
                        requester: { select: { id: true, name: true, email: true, role: true } }
                    }
                }
            }
        });

        if (!profile) return res.status(404).json({ message: 'Staff file not found' });

        res.json({
            id: profile.id,
            userId: profile.userId,
            name: profile.user.name,
            email: profile.user.email,
            staffId: profile.staffId,
            highestQualification: profile.highestQualification,
            title: profile.title,
            phone: profile.phone,
            gender: profile.gender,
            stateOfOrigin: profile.stateOfOrigin,
            lga: profile.lga,
            address: profile.address,
            passportUrl: profile.passportUrl,
            nin: profile.nin,
            bankName: profile.bankName,
            accountNumber: profile.accountNumber,
            accountName: profile.accountName,
            cadre: profile.cadre || (profile.cadreType === 'ACADEMIC' ? 'ACADEMIC' : 'ADMINISTRATIVE'),
            cadreType: profile.cadreType,
            level: profile.level,
            step: profile.step,
            rank: profile.rank,
            role: profile.user.role,
            unit: profile.unit,
            studyCenter: profile.studyCenter,
            dateOfBirth: profile.dateOfBirth,
            dateOfFirstAppointment: profile.dateOfFirstAppointment,
            statutoryRetirementDate: profile.statutoryRetirementDate,
            statutoryRetirementReason: profile.statutoryRetirementReason,
            lastPromotionDate: profile.lastPromotionDate || profile.dateOfLastPromotion,
            nextPromotionDueYear: profile.nextPromotionDueYear || profile.nextDueYear,
            nextPromotionDueDate: profile.nextPromotionDueDate || profile.nextDueDate,
            promotionEligibilityStatus: profile.promotionEligibilityStatus || profile.eligibilityStatus,
            accountStatus: profile.accountStatus,
            isActivated: profile.isActivated,
            employmentCategory: profile.employmentCategory,
            contractStartDate: profile.contractStartDate,
            contractEndDate: profile.contractEndDate,
            callUpNumber: profile.callUpNumber,
            stateCode: profile.stateCode,
            serviceYearBatch: profile.serviceYearBatch,
            volunteerProgramName: profile.volunteerProgramName,
            createdAt: profile.createdAt,
            createdBy: profile.createdBy,
            staffProfile: profile
        });
    } catch (error) {
        console.error('Get Staff File Error', error);
        res.status(500).json({ message: 'Error fetching staff file' });
    }
};

export const deleteStaffFile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        // @ts-ignore
        const requesterId = req.user?.id;

        if (!password) {
            return res.status(400).json({ message: 'Password is required to confirm deletion' });
        }

        const requester = await prisma.user.findUnique({
            where: { id: requesterId }
        });

        if (!requester) {
            return res.status(404).json({ message: 'Requester account not found' });
        }

        const isPasswordCorrect = await bcrypt.compare(password, requester.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: 'Incorrect password. Deletion cancelled.' });
        }

        let profile = await prisma.staffProfile.findFirst({
            where: {
                OR: [
                    { id },
                    { staffId: id }
                ]
            }
        });

        if (!profile) return res.status(404).json({ message: 'Staff file not found' });

        await prisma.$transaction(async (tx) => {
            await tx.staffProfile.update({
                where: { id: profile!.id },
                data: {
                    isDeleted: true,
                    deletedAt: new Date()
                }
            });

            await tx.user.update({
                where: { id: profile!.userId },
                data: {
                    isActive: false
                }
            });
        });

        await redisService.del(`user:session:${profile!.userId}`);
        res.json({ message: 'Staff file successfully archived' });
    } catch (error) {
        console.error('Delete Staff File Error', error);
        res.status(500).json({ message: 'Error archiving staff file' });
    }
};

export const getArchivedFiles = async (req: Request, res: Response) => {
    try {
        const securityCode = req.headers['x-archive-code'] || req.query.code;
        if (securityCode !== 'NOUN2026') {
            return res.status(403).json({ message: 'Invalid archive security code' });
        }

        const archived = await prisma.staffProfile.findMany({
            where: { isDeleted: true },
            include: {
                user: true,
                unit: true,
                studyCenter: true
            },
            orderBy: { deletedAt: 'desc' }
        });

        res.json(archived);
    } catch (error) {
        console.error('Get Archived Files Error', error);
        res.status(500).json({ message: 'Error fetching archived files' });
    }
};

export const restoreStaffFile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const securityCode = req.headers['x-archive-code'] || req.body.code;

        if (securityCode !== 'NOUN2026') {
            return res.status(403).json({ message: 'Invalid archive security code' });
        }

        const profile = await prisma.staffProfile.findFirst({
            where: {
                OR: [
                    { id },
                    { staffId: id }
                ]
            }
        });

        if (!profile) return res.status(404).json({ message: 'Staff file not found' });

        await prisma.$transaction(async (tx) => {
            await tx.staffProfile.update({
                where: { id: profile!.id },
                data: {
                    isDeleted: false,
                    deletedAt: null,
                    status: 'ACTIVE'
                }
            });

            await tx.user.update({
                where: { id: profile!.userId },
                data: {
                    isActive: true
                }
            });
        });

        await redisService.del(`user:session:${profile!.userId}`);
        res.json({ message: 'Staff file restored successfully' });
    } catch (error) {
        console.error('Restore Staff File Error', error);
        res.status(500).json({ message: 'Error restoring staff file' });
    }
};
