import { Request, Response } from 'express';
import { Role, TransferStatus } from '@prisma/client';
import { sendTransferNotification } from '../services/email.service';
import { notifyUser } from './notification.controller';
import { parse } from 'csv-parse';
import fs from 'fs';
import prisma from '../prisma';
import { redisService } from '../services/redis.service';
import PDFDocument from 'pdfkit';
import { getDirectorPlacementScope } from '../services/leaveEntitlement.service';

/**
 * Helper to check if a user is an authorized registrar / principal officer
 */
const isRegistrarOrSuper = (role?: string): boolean => {
    return role === Role.REGISTRAR || role === Role.SUPER_USER || role === Role.VICE_CHANCELLOR;
};

/**
 * POST /api/v1/registry/transfers or POST /api/registry/transfer
 * Imputer drafts a staff transfer / posting order. Staged as PENDING_REGISTRAR_AUTHORIZATION.
 */
export const transferStaff = async (req: Request, res: Response) => {
    try {
        const {
            staffId,
            toCenterId,
            toUnitId,
            reason,
            effectiveDate,
            relocationAllowance = false,
            relocationAllowanceAmount = 0
        } = req.body;

        // @ts-ignore
        const initiatedById = req.user?.id;

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
            include: { user: true, studyCenter: true, unit: true }
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

        // 3. Create TransferLog with PENDING_REGISTRAR_AUTHORIZATION status
        const transferLog = await prisma.transferLog.create({
            data: {
                staffId: staff.user.id,
                initiatedById,
                oldUnitId,
                oldCenterId: oldCenterId || oldUnitId || 'Unassigned',
                newUnitId,
                newCenterId: newCenterId || newUnitId,
                status: TransferStatus.PENDING_REGISTRAR_AUTHORIZATION,
                relocationAllowance: Boolean(relocationAllowance),
                relocationAllowanceAmount: relocationAllowance ? Number(relocationAllowanceAmount) : null,
                isEffective: false,
                applied: false,
                reason: reason || 'Official Administrative Posting',
                effectiveDate: new Date(effectiveDate || Date.now())
            },
            include: {
                staff: { select: { name: true, email: true } },
                oldUnit: { select: { name: true } },
                newUnit: { select: { name: true } }
            }
        });

        // 4. Notify Registrar / Super Users of pending authorization
        const registrars = await prisma.user.findMany({
            where: {
                role: { in: [Role.REGISTRAR, Role.SUPER_USER] },
                isActive: true
            },
            select: { id: true }
        });

        const staffName = `${staff.surname || ''} ${staff.otherNames || ''}`.trim() || staff.user.name || 'Staff';

        for (const reg of registrars) {
            await prisma.notification.create({
                data: {
                    userId: reg.id,
                    title: '📋 Posting Order Awaiting Authorization',
                    message: `Draft posting order created for ${staffName} (${staff.staffId || 'N/A'}) to ${destinationName}. Requires Registrar clearance.`,
                    type: 'INFO',
                    link: '/dashboard/registry/transfers'
                }
            });
        }

        res.status(201).json({
            message: 'Posting order drafted successfully and submitted for Registrar authorization.',
            transferLog
        });
    } catch (error: any) {
        console.error('Transfer drafting error:', error);
        res.status(500).json({ message: 'Internal server error drafting posting order', error: error.message });
    }
};

/**
 * GET /api/v1/registry/transfers/pending-authorization
 * Returns all posting orders awaiting Registrar authorization
 */
export const getPendingTransfers = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const requesterRole = req.user?.role;
        if (!isRegistrarOrSuper(requesterRole) && requesterRole !== Role.HR_ADMIN) {
            return res.status(403).json({ message: 'Forbidden: Insufficient privileges' });
        }

        const pending = await prisma.transferLog.findMany({
            where: {
                status: TransferStatus.PENDING_REGISTRAR_AUTHORIZATION
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
                initiatedBy: { select: { id: true, name: true, email: true } },
                oldUnit: { select: { id: true, name: true } },
                newUnit: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(pending);
    } catch (error: any) {
        console.error('Error fetching pending transfers:', error);
        res.status(500).json({ message: 'Failed to fetch pending postings' });
    }
};

/**
 * POST /api/v1/registry/transfers/:id/authorize
 * Authorizer (Registrar) approves the posting order. Atomically updates staff placement and generates posting order seal.
 */
export const authorizeTransfer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { remarks, digitalSignatureRef } = req.body;
        // @ts-ignore
        const authorizerId = req.user?.id;
        // @ts-ignore
        const authorizerRole = req.user?.role;

        if (!isRegistrarOrSuper(authorizerRole)) {
            return res.status(403).json({ message: 'Unauthorized: Only the Registrar or Super User can authorize postings.' });
        }

        const transfer = await prisma.transferLog.findUnique({
            where: { id },
            include: {
                staff: {
                    include: {
                        staffProfile: {
                            include: {
                                unit: true,
                                studyCenter: true
                            }
                        }
                    }
                },
                initiatedBy: { select: { id: true, name: true, email: true } },
                oldUnit: true,
                newUnit: true
            }
        });

        if (!transfer) {
            return res.status(404).json({ message: 'Transfer record not found' });
        }

        if (transfer.status === TransferStatus.APPROVED) {
            return res.status(400).json({ message: 'Posting order has already been authorized.' });
        }

        const staffProfile = transfer.staff?.staffProfile;
        if (!staffProfile) {
            return res.status(404).json({ message: 'Staff profile associated with this transfer was not found.' });
        }

        const now = new Date();
        const signatureSeal = digitalSignatureRef || `NOUN-REGISTRAR-SEAL-${Date.now().toString(36).toUpperCase()}`;

        // Atomic transaction: Authorize transfer log and apply to staff profile
        await prisma.$transaction(async (tx) => {
            // 1. Update transfer log
            await tx.transferLog.update({
                where: { id },
                data: {
                    status: TransferStatus.APPROVED,
                    isEffective: true,
                    applied: true,
                    authorizedById: authorizerId,
                    authorizedAt: now,
                    authorizationRemarks: remarks || 'Authorized by Registrar',
                    digitalSignatureRef: signatureSeal
                }
            });

            // 2. Apply destination to StaffProfile
            await tx.staffProfile.update({
                where: { id: staffProfile.id },
                data: {
                    unitId: transfer.newUnitId || null,
                    centerId: (!transfer.newUnitId && transfer.newCenterId) ? transfer.newCenterId : null
                }
            });

            // 3. Audit Log
            await tx.auditLog.create({
                data: {
                    userId: authorizerId,
                    action: 'AUTHORIZE_STAFF_TRANSFER',
                    resource: 'TRANSFER_LOG',
                    details: JSON.stringify({
                        transferId: id,
                        staffId: transfer.staffId,
                        destinationUnitId: transfer.newUnitId,
                        destinationCenterId: transfer.newCenterId,
                        signatureSeal
                    }),
                    ipAddress: req.ip
                }
            });
        });

        // 4. Invalidate Redis caches
        await Promise.all([
            redisService.clearPattern('staff:*'),
            redisService.clearPattern('analytics:*'),
            redisService.clearPattern('hr:analytics:*'),
            redisService.del(`user:session:${transfer.staffId}`)
        ]);

        // 5. Notify Staff Member
        const destName = transfer.newUnit?.name || 'Assigned Destination';
        await notifyUser(
            transfer.staffId,
            '✅ Official Posting Order Authorized',
            `Your official posting to ${destName} has been authorized and signed by the Registrar. Effective date: ${transfer.effectiveDate.toLocaleDateString('en-NG')}.`,
            'SUCCESS',
            '/dashboard/profile'
        );

        // 6. Notify Initiator (HR Admin)
        if (transfer.initiatedById && transfer.initiatedById !== authorizerId) {
            await notifyUser(
                transfer.initiatedById,
                '✅ Posting Order Approved',
                `Posting order for ${transfer.staff.name} to ${destName} has been authorized by the Registrar.`,
                'SUCCESS',
                '/dashboard/registry/transfers'
            );
        }

        // 7. Send official email notification
        if (transfer.staff.email) {
            sendTransferNotification(
                transfer.staff.email,
                transfer.staff.name || 'Staff Member',
                transfer.oldUnit?.name || 'Previous Department',
                destName,
                transfer.effectiveDate
            ).catch(e => console.error('Email dispatch error on transfer authorization:', e));
        }

        res.json({
            message: 'Posting order authorized successfully. Staff profile updated.',
            digitalSignatureRef: signatureSeal,
            authorizedAt: now
        });
    } catch (error: any) {
        console.error('Error authorizing transfer:', error);
        res.status(500).json({ message: 'Internal server error authorizing posting', error: error.message });
    }
};

/**
 * POST /api/v1/registry/transfers/:id/reject
 * Authorizer (Registrar) rejects the draft posting order
 */
export const rejectTransfer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        // @ts-ignore
        const authorizerId = req.user?.id;
        // @ts-ignore
        const authorizerRole = req.user?.role;

        if (!isRegistrarOrSuper(authorizerRole)) {
            return res.status(403).json({ message: 'Unauthorized: Only the Registrar or Super User can reject postings.' });
        }

        const transfer = await prisma.transferLog.findUnique({
            where: { id },
            include: {
                staff: { select: { name: true } },
                initiatedBy: { select: { id: true, name: true, email: true } }
            }
        });

        if (!transfer) {
            return res.status(404).json({ message: 'Transfer record not found' });
        }

        await prisma.transferLog.update({
            where: { id },
            data: {
                status: TransferStatus.REJECTED,
                rejectionReason: reason || 'Posting order rejected by Registrar',
                authorizedById: authorizerId,
                authorizedAt: new Date()
            }
        });

        // Notify Initiating HR Admin
        if (transfer.initiatedById) {
            await notifyUser(
                transfer.initiatedById,
                '❌ Posting Order Rejected',
                `The draft posting for ${transfer.staff?.name || 'Staff'} was rejected by the Registrar. Reason: ${reason || 'No reason specified'}`,
                'ERROR',
                '/dashboard/registry/transfers'
            );
        }

        res.json({ message: 'Posting order rejected successfully.' });
    } catch (error: any) {
        console.error('Error rejecting transfer:', error);
        res.status(500).json({ message: 'Internal server error rejecting posting', error: error.message });
    }
};

/**
 * GET /api/v1/registry/transfers/:id/letter
 * Generates and downloads official Registrar-signed posting order letter in PDF format
 */
export const downloadPostingOrderLetter = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const transfer = await prisma.transferLog.findUnique({
            where: { id },
            include: {
                staff: {
                    include: {
                        staffProfile: {
                            include: {
                                unit: true,
                                studyCenter: true
                            }
                        }
                    }
                },
                authorizedBy: { select: { name: true, email: true } },
                initiatedBy: { select: { name: true } },
                oldUnit: true,
                newUnit: true
            }
        });

        if (!transfer) {
            return res.status(404).json({ message: 'Transfer record not found' });
        }

        const staffProfile = transfer.staff?.staffProfile;
        const staffName = `${staffProfile?.surname || ''} ${staffProfile?.otherNames || ''}`.trim() || transfer.staff?.name || 'Staff Member';
        const staffId = staffProfile?.staffId || 'N/A';
        const rank = staffProfile?.rank || 'Staff';
        const oldLocation = transfer.oldUnit?.name || 'Previous Department';
        const newLocation = transfer.newUnit?.name || 'Target Directorate / Unit';
        const effectiveDateStr = transfer.effectiveDate.toLocaleDateString('en-NG', { dateStyle: 'long' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Posting-Order-${staffId.replace('/', '-')}.pdf"`);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        doc.pipe(res);

        // Official University Letterhead
        doc.fontSize(16).text('NATIONAL OPEN UNIVERSITY OF NIGERIA', { align: 'center', bold: true } as any);
        doc.fontSize(11).text('University Village, Plot 91, Cadastral Zone, Nnamdi Azikiwe Expressway, Jabi, Abuja', { align: 'center' });
        doc.fontSize(12).text('OFFICE OF THE REGISTRAR', { align: 'center', underline: true });
        doc.moveDown(1);

        // Metadata block
        doc.fontSize(10).text(`Ref: NOUN/REG/POST/${transfer.id.slice(0, 8).toUpperCase()}`);
        doc.text(`Date: ${new Date().toLocaleDateString('en-NG', { dateStyle: 'long' })}`);
        doc.moveDown(1);

        // Recipient block
        doc.text(`To: ${staffName} (${staffId})`);
        doc.text(`Rank: ${rank}`);
        doc.text(`Current Posting: ${oldLocation}`);
        doc.moveDown(1);

        // Title
        doc.fontSize(12).fillColor('#002B49').text('INTERNAL POSTING ORDER / REDEPLOYMENT', { align: 'center', underline: true });
        doc.fillColor('#000000').fontSize(10).moveDown(1);

        // Body Text
        doc.text(`I am directed by the Registrar to inform you that you have been redeployed from ${oldLocation} to ${newLocation} with effect from ${effectiveDateStr}.`);
        doc.moveDown(0.7);

        if (transfer.relocationAllowance) {
            doc.text(`You are eligible for relocation allowance in the amount of ₦${(transfer.relocationAllowanceAmount || 0).toLocaleString()} in accordance with Public Service Regulations.`);
            doc.moveDown(0.7);
        }

        doc.text(`You are expected to formally hand over all university properties and responsibilities in your custody to your Head of Unit before reporting to your new duty station.`);
        doc.moveDown(1.5);

        // Signature Seal
        doc.text('Yours faithfully,');
        doc.moveDown(2);
        doc.text('_____________________________');
        doc.fontSize(10).text(transfer.authorizedBy?.name || 'REGISTRAR', { bold: true } as any);
        doc.text('For: Registrar & Secretary to Council');
        doc.moveDown(1);

        // Digital Seal stamp box
        doc.rect(50, doc.y, 495, 45).stroke('#002B49');
        doc.fontSize(8).fillColor('#002B49').text(`DIGITAL AUTHORIZATION SEAL: ${transfer.digitalSignatureRef || 'VERIFIED-REGISTRAR-SEAL'}`, 55, doc.y + 5);
        doc.text(`Authorized At: ${transfer.authorizedAt ? transfer.authorizedAt.toISOString() : new Date().toISOString()} | Verification Hash: SHA256-${transfer.id}`, 55, doc.y + 16);

        doc.end();
    } catch (error: any) {
        console.error('Error generating posting letter:', error);
        res.status(500).json({ message: 'Error generating posting order letter', error: error.message });
    }
};

/**
 * GET /api/registry/transfers
 * Returns transfer history with optional staffId filter and role scoping
 */
export const getTransferHistory = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const requesterId = req.user?.id;
        // @ts-ignore
        const requesterRole = req.user?.role;
        const { staffId } = req.query;

        let whereCondition: any = {};

        if (staffId) {
            const targetProfile = await prisma.staffProfile.findFirst({
                where: {
                    OR: [
                        { userId: String(staffId) },
                        { id: String(staffId) },
                        { staffId: String(staffId) }
                    ]
                },
                select: { userId: true }
            });
            const resolvedUserId = targetProfile?.userId || String(staffId);
            whereCondition.staffId = resolvedUserId;
        } else if (!isRegistrarOrSuper(requesterRole) && requesterRole !== Role.HR_ADMIN && requesterRole !== Role.REGISTRY_ADMIN && requesterRole !== Role.ADMIN) {
            if (requesterRole === Role.STAFF) {
                whereCondition.staffId = requesterId;
            } else if ([Role.UNIT_HEAD, Role.STUDY_CENTER_MANAGER, Role.UNIT_ADMIN, Role.BURSARY].includes(requesterRole as any)) {
                if (requesterId) {
                    const scope = await getDirectorPlacementScope(requesterId, requesterRole);
                    whereCondition.OR = [
                        ...(scope.unitIds.length > 0 ? [{ oldUnitId: { in: scope.unitIds } }, { newUnitId: { in: scope.unitIds } }] : []),
                        ...(scope.allPlacementIds.length > 0 ? [{ oldCenterId: { in: scope.allPlacementIds } }, { newCenterId: { in: scope.allPlacementIds } }] : []),
                        ...(scope.locationNames.length > 0 ? [{ oldCenterId: { in: scope.locationNames } }, { newCenterId: { in: scope.locationNames } }] : [])
                    ];
                    if (!whereCondition.OR || whereCondition.OR.length === 0) {
                        return res.json([]);
                    }
                }
            }
        }

        const [history, centers, units] = await Promise.all([
            prisma.transferLog.findMany({
                where: whereCondition,
                include: {
                    staff: { select: { id: true, name: true, email: true, staffProfile: { select: { id: true, staffId: true, rank: true, surname: true, otherNames: true } } } },
                    initiatedBy: { select: { id: true, name: true } },
                    authorizedBy: { select: { id: true, name: true } },
                    oldUnit: { select: { id: true, name: true, code: true } },
                    newUnit: { select: { id: true, name: true, code: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.studyCenter.findMany(),
            prisma.unit.findMany()
        ]);

        const locationMap = new Map<string, string>();
        centers.forEach(c => locationMap.set(c.id, c.name));
        units.forEach(u => locationMap.set(u.id, u.name));

        const enrichedHistory = history.map(log => ({
            ...log,
            oldLocation: log.oldUnit?.name || locationMap.get(log.oldCenterId || '') || log.oldCenterId || 'Previous Duty Station',
            newLocation: log.newUnit?.name || locationMap.get(log.newCenterId || '') || log.newCenterId || 'New Duty Station'
        }));

        res.json(enrichedHistory);
    } catch (error) {
        console.error('Error fetching transfer history:', error);
        res.status(500).json({ message: 'Error fetching history' });
    }
};

export const getCenters = async (req: Request, res: Response) => {
    try {
        const centers = await prisma.studyCenter.findMany();
        const units = await prisma.unit.findMany();
        res.json({ centers, units });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching centers' });
    }
};

export const batchTransfer = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'CSV file required' });
        }

        const results: any[] = [];
        const errors: any[] = [];
        // @ts-ignore
        const initiatedById = req.user.id;

        const parser = fs.createReadStream(req.file.path).pipe(parse({
            columns: true,
            skip_empty_lines: true,
            trim: true
        }));

        for await (const row of parser) {
            const { email, target_code, type, reason, effective_date } = row;

            try {
                const staff = await prisma.user.findUnique({
                    where: { email },
                    include: { staffProfile: true }
                });

                if (!staff || !staff.staffProfile) {
                    throw new Error(`Staff with email ${email} not found`);
                }

                let newCenterId: string | null = null;
                let newUnitId: string | null = null;

                if (type === 'CENTER') {
                    const c = await prisma.studyCenter.findUnique({ where: { code: target_code } });
                    if (!c) throw new Error(`Center code ${target_code} invalid`);
                    newCenterId = c.id;
                } else {
                    const u = await prisma.unit.findFirst({ where: { code: target_code } });
                    if (!u) throw new Error(`Unit code ${target_code} invalid`);
                    newUnitId = u.id;
                }

                await prisma.transferLog.create({
                    data: {
                        staffId: staff.id,
                        initiatedById,
                        oldCenterId: staff.staffProfile.unitId || staff.staffProfile.centerId || 'Unassigned',
                        newCenterId: newUnitId || newCenterId,
                        newUnitId,
                        status: TransferStatus.PENDING_REGISTRAR_AUTHORIZATION,
                        reason: reason || 'Batch Transfer',
                        effectiveDate: new Date(effective_date || Date.now())
                    }
                });

                results.push({ email, status: 'Success - Staged for Registrar Authorization' });
            } catch (err: any) {
                errors.push({ email, error: err.message });
            }
        }

        await fs.promises.unlink(req.file.path);

        res.json({
            message: 'Batch processing complete',
            successful: results.length,
            failed: errors.length,
            errors
        });
    } catch (error) {
        console.error('Batch transfer error:', error);
        res.status(500).json({ message: 'Internal server error during batch processing' });
    }
};
