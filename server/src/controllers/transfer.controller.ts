
import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { sendTransferNotification } from '../services/email.service';
import { notifyUser } from './notification.controller';
import { parse } from 'csv-parse';
import fs from 'fs';
import prisma from '../prisma';

// ... existing code ...

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
            // Expected CSV Header: email, target_code, type (CENTER/UNIT), reason, effective_date
            const { email, target_code, type, reason, effective_date } = row;

            try {
                // 1. Find Staff
                const staff = await prisma.user.findUnique({
                    where: { email },
                    include: { staffProfile: true }
                });

                if (!staff || !staff.staffProfile) {
                    throw new Error(`Staff with email ${email} not found`);
                }

                // 2. Resolve Target
                let newCenterId: string | null = null;
                let newUnitId: string | null = null;
                let newLocationName = 'Unknown';

                if (type === 'CENTER') {
                    const c = await prisma.studyCenter.findUnique({ where: { code: target_code } });
                    if (!c) throw new Error(`Center code ${target_code} invalid`);
                    newCenterId = c.id;
                    newLocationName = c.name;
                } else {
                    const u = await prisma.unit.findFirst({ where: { code: target_code } }); // Assuming Unit has code
                    if (!u) throw new Error(`Unit code ${target_code} invalid`);
                    newUnitId = u.id;
                    newLocationName = u.name;
                }

                // 3. Create Log & Update
                await prisma.transferLog.create({
                    data: {
                        staffId: staff.id,
                        initiatedById,
                        oldCenterId: staff.staffProfile.unitId || staff.staffProfile.centerId || 'Unassigned',
                        newCenterId: newUnitId || newCenterId,
                        reason: reason || 'Batch Transfer',
                        effectiveDate: new Date(effective_date || Date.now())
                    }
                });

                // Deferred Activation: Update is skipped here.
                // The transfer remains applied: false and will be processed upon their next login after 48 hours.

                // Notify staff member immediately via system notification
                await notifyUser(
                    staff.id,
                    'Transfer Initiated',
                    `You have been scheduled for transfer to ${newLocationName}. This transfer will take effect on your next login after 48 hours.`,
                    'WARNING',
                    '/dashboard/profile'
                );

                // 4. Notify
                sendTransferNotification(
                    staff.email,
                    staff.name || 'Staff',
                    'Previous Post',
                    newLocationName,
                    new Date(effective_date || Date.now())
                ).catch(e => console.error('Batch email failed', e));

                results.push({ email, status: 'Success' });

            } catch (err: any) {
                errors.push({ email, error: err.message });
            }
        }

        // Cleanup
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

// Get available study centers/units for dropdown
export const getCenters = async (req: Request, res: Response) => {
    try {
        const centers = await prisma.studyCenter.findMany();
        const units = await prisma.unit.findMany(); // also return units for HQ posting
        res.json({ centers, units });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching centers' });
    }
};

export const transferStaff = async (req: Request, res: Response) => {
    try {
        const { staffId, toCenterId, toUnitId, reason, effectiveDate } = req.body;
        // @ts-ignore
        const initiatedById = req.user.id;

        // 1. Get Staff
        const staff = await prisma.staffProfile.findUnique({
            where: { userId: staffId }, // Assuming staffId passed is the UserID? OR staffId field?
            // Usually internal logic uses User ID (UUID). Let's assume UserUUID.
            // If the UI sends the 'staffId' string (e.g. N001), we need to find by staffId field.
            // Let's assume UUID for consistency with other APIs.
            include: { user: true, studyCenter: true, unit: true }
        });

        if (!staff) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        const oldCenter = staff.studyCenter?.name || staff.unit?.name || 'Unassigned';
        const oldCenterId = staff.studyCenter?.id || staff.unit?.id;

        // 2. Validate Target
        let newCenterName = '';
        if (toCenterId) {
            const c = await prisma.studyCenter.findUnique({ where: { id: toCenterId } });
            if (!c) return res.status(404).json({ message: 'Target Center not found' });
            newCenterName = c.name;
        } else if (toUnitId) {
            const u = await prisma.unit.findUnique({ where: { id: toUnitId } });
            if (!u) return res.status(404).json({ message: 'Target Unit not found' });
            newCenterName = u.name;
        } else {
            return res.status(400).json({ message: 'Destination required' });
        }

        // 3. Create Transfer Log (formerly PostingHistory)
        await prisma.transferLog.create({
            data: {
                staffId: staff.user.id, // User UUID
                initiatedById,
                oldCenterId: staff.unitId || staff.centerId || 'Unassigned', 
                newCenterId: toUnitId || toCenterId,
                reason,
                effectiveDate: new Date(effectiveDate || Date.now())
            }
        });

        // Deferred Activation: Update is skipped here.
        // The transfer remains applied: false and will be processed upon their next login after 48 hours.

        // Notify staff member immediately via system notification
        await notifyUser(
            staff.user.id,
            'Transfer Initiated',
            `You have been scheduled for transfer to ${newCenterName}. This transfer will take effect on your next login after 48 hours.`,
            'WARNING',
            '/dashboard/profile'
        );

        // 5. Send Notification
        // Trigger Email Service
        if (staff.user.email) {
            sendTransferNotification(
                staff.user.email,
                staff.user.name || 'Staff',
                oldCenter,
                newCenterName,
                new Date(effectiveDate)
            ).catch(e => console.error('Email failed', e));
        }

        res.json({ message: 'Transfer successful' });

    } catch (error) {
        console.error('Transfer error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getTransferHistory = async (req: Request, res: Response) => {
    try {
        const [history, centers, units] = await Promise.all([
            prisma.transferLog.findMany({
                include: {
                    staff: { select: { name: true, email: true } },
                    initiatedBy: { select: { name: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.studyCenter.findMany(),
            prisma.unit.findMany()
        ]);

        // Create Lookup Map
        const locationMap = new Map<string, string>();
        centers.forEach(c => locationMap.set(c.id, c.name));
        units.forEach(u => locationMap.set(u.id, u.name));

        const enrichedHistory = history.map(log => ({
            ...log,
            oldCenterId: locationMap.get(log.oldCenterId || '') || log.oldCenterId || 'Unassigned',
            newCenterId: locationMap.get(log.newCenterId || '') || log.newCenterId || 'Unknown'
        }));

        res.json(enrichedHistory);
    } catch (error) {
        console.error('Error fetching transfer history:', error);
        res.status(500).json({ message: 'Error fetching history' });
    }
};
