import { Request, Response } from 'express';
import prisma from '../prisma';
import { Role } from '@prisma/client';
import { sendPushNotification } from '../services/fcm.service';
import { notifyUser } from './notification.controller';

interface AuthRequest extends Request {
    user?: { id: string; role: Role };
}

// 1. Create Payment Voucher
export const createVoucher = async (req: AuthRequest, res: Response) => {
    const { title, amount, description, category, unitId } = req.body;
    const createdByUserId = req.user!.id;

    try {
        if (!title || !amount || !description || !category) {
            return res.status(400).json({ message: 'Title, amount, description, and category are required' });
        }

        if (Number(amount) <= 0) {
            return res.status(400).json({ message: 'Amount must be greater than zero' });
        }

        const voucher = await prisma.paymentVoucher.create({
            data: {
                title,
                amount: parseFloat(amount),
                description,
                category,
                status: 'PENDING',
                unitId: unitId || null,
                createdByUserId
            },
            include: { createdByUser: { select: { name: true, email: true, role: true } } }
        });

        // Notify the Unit Head of the unit (or all unit heads if no unitId is specified)
        const unitHeads = await prisma.user.findMany({
            where: {
                role: 'UNIT_HEAD',
                isActive: true
            }
        });

        if (unitHeads.length > 0) {
            const headIds = unitHeads.map(h => h.id);
            // In-app notification
            for (const headId of headIds) {
                await notifyUser(
                    headId,
                    'New Payment Voucher Request',
                    `A payment voucher "${title}" for ₦${parseFloat(amount).toLocaleString()} requires your recommendation.`,
                    'INFO',
                    '/dashboard/bursary'
                );
            }
        }

        res.status(201).json(voucher);
    } catch (error: any) {
        console.error('Failed to create voucher:', error);
        res.status(500).json({ message: 'Failed to create payment voucher' });
    }
};

// 2. Get Vouchers (Filtered by status/category/unit)
export const getVouchers = async (req: AuthRequest, res: Response) => {
    const { status, category, unitId } = req.query;

    try {
        const filters: any = {};
        if (status) filters.status = String(status);
        if (category) filters.category = String(category);
        if (unitId) filters.unitId = String(unitId);

        const vouchers = await prisma.paymentVoucher.findMany({
            where: filters,
            include: { createdByUser: { select: { name: true, email: true, role: true } } },
            orderBy: { createdAt: 'desc' }
        });

        res.json(vouchers);
    } catch (error) {
        console.error('Failed to fetch vouchers:', error);
        res.status(500).json({ message: 'Failed to fetch payment vouchers' });
    }
};

// 3. Update Voucher Status (Approval Workflow)
export const updateVoucherStatus = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status, auditComment } = req.body;
    const userId = req.user!.id;
    const role = req.user!.role;

    try {
        const voucher = await prisma.paymentVoucher.findUnique({
            where: { id }
        });

        if (!voucher) {
            return res.status(404).json({ message: 'Payment voucher not found' });
        }

        // Validate Workflow Stage & Role Privileges
        if (status === 'RECOMMENDED_BY_HEAD') {
            if (role !== 'UNIT_HEAD' && role !== 'SUPER_USER' && role !== 'ADMIN') {
                return res.status(403).json({ message: 'Only Unit Heads can recommend payment vouchers' });
            }
            if (voucher.status !== 'PENDING') {
                return res.status(400).json({ message: 'Voucher must be in PENDING status to be recommended' });
            }
        } else if (status === 'AUDITED_BY_BURSARY') {
            if (role !== 'BURSARY' && role !== 'SUPER_USER' && role !== 'ADMIN') {
                return res.status(403).json({ message: 'Only Bursary Auditor staff can audit payment vouchers' });
            }
            if (voucher.status !== 'RECOMMENDED_BY_HEAD') {
                return res.status(400).json({ message: 'Voucher must be RECOMMENDED before auditing' });
            }
        } else if (status === 'APPROVED') {
            if (!['SUPER_USER', 'HR_ADMIN', 'ADMIN', 'VICE_CHANCELLOR'].includes(role)) {
                return res.status(403).json({ message: 'Unauthorized. Requires Finance Director / VC approval privileges.' });
            }
            if (voucher.status !== 'AUDITED_BY_BURSARY') {
                return res.status(400).json({ message: 'Voucher must be AUDITED by Bursary before final approval' });
            }
        } else if (status === 'REJECTED') {
            if (!auditComment) {
                return res.status(400).json({ message: 'An audit comment detailing the rejection reason is required' });
            }
            if (!['UNIT_HEAD', 'BURSARY', 'SUPER_USER', 'HR_ADMIN', 'ADMIN', 'VICE_CHANCELLOR'].includes(role)) {
                return res.status(403).json({ message: 'Unauthorized to reject payment vouchers' });
            }
        } else {
            return res.status(400).json({ message: 'Invalid target status transition' });
        }

        // Apply Status Update
        const updated = await prisma.paymentVoucher.update({
            where: { id },
            data: {
                status,
                auditComment: auditComment || voucher.auditComment
            },
            include: { createdByUser: { select: { name: true, email: true, role: true } } }
        });

        // Notify Creator
        await notifyUser(
            voucher.createdByUserId,
            `Voucher Status Update: ${status}`,
            `Your payment voucher "${voucher.title}" has been updated to ${status}.${auditComment ? ` Reason: ${auditComment}` : ''}`,
            status === 'REJECTED' ? 'ERROR' : status === 'APPROVED' ? 'SUCCESS' : 'INFO',
            '/dashboard/bursary'
        );

        // Notify next workflow role
        if (status === 'RECOMMENDED_BY_HEAD') {
            // Notify Bursary staff
            const bursaryStaff = await prisma.user.findMany({
                where: { role: 'BURSARY', isActive: true },
                select: { id: true }
            });
            for (const b of bursaryStaff) {
                await notifyUser(
                    b.id,
                    'Voucher Awaiting Audit Review',
                    `Voucher "${voucher.title}" has been recommended by Unit Head. Awaiting audit review.`,
                    'INFO',
                    '/dashboard/bursary'
                );
            }
        } else if (status === 'AUDITED_BY_BURSARY') {
            // Notify Admin/VC
            const admins = await prisma.user.findMany({
                where: { role: { in: ['SUPER_USER', 'VICE_CHANCELLOR', 'HR_ADMIN'] }, isActive: true },
                select: { id: true }
            });
            for (const adminUser of admins) {
                await notifyUser(
                    adminUser.id,
                    'Voucher Awaiting Final Approval',
                    `Voucher "${voucher.title}" has passed audit. Awaiting final approval.`,
                    'INFO',
                    '/dashboard/bursary'
                );
            }
        }

        // Log forensic activity
        await prisma.auditLog.create({
            data: {
                userId,
                action: 'UPDATE_STATUS',
                resource: 'PAYMENT_VOUCHER',
                details: JSON.stringify({ voucherId: id, oldStatus: voucher.status, newStatus: status, comment: auditComment }),
                ipAddress: req.ip
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Failed to update voucher status:', error);
        res.status(500).json({ message: 'Failed to update payment voucher status' });
    }
};
