import { Request, Response } from 'express';
import prisma from '../prisma';
import { Role } from '@prisma/client';
import { notifyUser } from './notification.controller';

interface AuthRequest extends Request {
    user?: { id: string; role: Role };
}

// 1. Get all gear
export const getGearList = async (req: AuthRequest, res: Response) => {
    try {
        const gear = await prisma.securityGear.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(gear);
    } catch (error) {
        console.error('Failed to fetch gear:', error);
        res.status(500).json({ message: 'Failed to fetch gear inventory' });
    }
};

// 2. Add or update gear item
export const addGearItem = async (req: AuthRequest, res: Response) => {
    const { name, totalQty, unit } = req.body;
    const role = req.user?.role;

    if (role !== 'SECURITY_HEAD' && role !== 'SUPER_USER' && role !== 'ADMIN') {
        return res.status(403).json({ message: 'Unauthorized: Security management privileges required' });
    }

    try {
        if (!name || totalQty === undefined) {
            return res.status(400).json({ message: 'Name and total quantity are required' });
        }

        const qty = Number(totalQty);
        if (qty < 0) {
            return res.status(400).json({ message: 'Quantity cannot be negative' });
        }

        // Upsert security gear
        const existing = await prisma.securityGear.findUnique({ where: { name } });

        let gear;
        if (existing) {
            const difference = qty - existing.totalQty;
            gear = await prisma.securityGear.update({
                where: { name },
                data: {
                    totalQty: qty,
                    availableQty: Math.max(0, existing.availableQty + difference)
                }
            });
        } else {
            gear = await prisma.securityGear.create({
                data: {
                    name,
                    totalQty: qty,
                    availableQty: qty,
                    unit: unit || 'pcs'
                }
            });
        }

        // Log forensic activity
        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: existing ? 'UPDATE' : 'CREATE',
                resource: 'SECURITY_GEAR',
                details: JSON.stringify({ gearId: gear.id, name, totalQty: qty }),
                ipAddress: req.ip
            }
        });

        res.status(201).json(gear);
    } catch (error) {
        console.error('Failed to save gear:', error);
        res.status(500).json({ message: 'Failed to save gear item' });
    }
};

// 3. Check out / Loan gear item to officer
export const loanGearItem = async (req: AuthRequest, res: Response) => {
    const { gearId, officerId, quantity } = req.body;
    const role = req.user?.role;

    if (role !== 'SECURITY_HEAD' && role !== 'SUPER_USER' && role !== 'ADMIN') {
        return res.status(403).json({ message: 'Unauthorized: Security head privileges required to dispatch equipment' });
    }

    try {
        if (!gearId || !officerId) {
            return res.status(400).json({ message: 'Gear ID and Officer ID are required' });
        }

        const qty = Number(quantity || 1);
        if (qty <= 0) {
            return res.status(400).json({ message: 'Loan quantity must be greater than zero' });
        }

        // Verify officer exists
        const officer = await prisma.user.findUnique({ where: { id: officerId } });
        if (!officer) {
            return res.status(404).json({ message: 'Officer profile not found' });
        }

        // Verify gear exists and has stock
        const gear = await prisma.securityGear.findUnique({ where: { id: gearId } });
        if (!gear) {
            return res.status(404).json({ message: 'Gear item not found' });
        }

        if (gear.availableQty < qty) {
            return res.status(400).json({ message: `Insufficient stock. Only ${gear.availableQty} ${gear.unit} available.` });
        }

        // Perform transaction
        const [loan] = await prisma.$transaction([
            prisma.securityGearLoan.create({
                data: {
                    gearId,
                    officerId,
                    quantity: qty,
                    status: 'LOANED'
                },
                include: { gear: true }
            }),
            prisma.securityGear.update({
                where: { id: gearId },
                data: {
                    availableQty: gear.availableQty - qty
                }
            })
        ]);

        // Notify officer
        await notifyUser(
            officerId,
            '🛠️ Equipment Dispatched',
            `You have been allocated ${qty} x ${gear.name}. Please check in upon return.`,
            'INFO',
            '/dashboard/security'
        );

        // Log forensic activity
        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'DISPATCH_GEAR',
                resource: 'SECURITY_GEAR',
                details: JSON.stringify({ loanId: loan.id, officerId, quantity: qty, gearName: gear.name }),
                ipAddress: req.ip
            }
        });

        res.status(201).json(loan);
    } catch (error) {
        console.error('Failed to loan gear:', error);
        res.status(500).json({ message: 'Failed to process equipment checkout' });
    }
};

// 4. Return gear item
export const returnGearItem = async (req: AuthRequest, res: Response) => {
    const { id } = req.params; // Loan ID
    const role = req.user?.role;

    if (role !== 'SECURITY_HEAD' && role !== 'SUPER_USER' && role !== 'ADMIN') {
        return res.status(403).json({ message: 'Unauthorized: Security head privileges required' });
    }

    try {
        const loan = await prisma.securityGearLoan.findUnique({
            where: { id },
            include: { gear: true }
        });

        if (!loan) {
            return res.status(404).json({ message: 'Gear loan record not found' });
        }

        if (loan.status === 'RETURNED') {
            return res.status(400).json({ message: 'Gear has already been returned' });
        }

        // Perform transaction
        const [updatedLoan] = await prisma.$transaction([
            prisma.securityGearLoan.update({
                where: { id },
                data: {
                    status: 'RETURNED',
                    returnedAt: new Date()
                },
                include: { gear: true }
            }),
            prisma.securityGear.update({
                where: { id: loan.gearId },
                data: {
                    availableQty: loan.gear.availableQty + loan.quantity
                }
            })
        ]);

        // Notify officer of return registration check
        await notifyUser(
            loan.officerId,
            '✅ Equipment Returned',
            `Your return of ${loan.quantity} x ${loan.gear.name} has been processed and logged.`,
            'SUCCESS',
            '/dashboard/security'
        );

        // Log forensic activity
        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'RETURN_GEAR',
                resource: 'SECURITY_GEAR',
                details: JSON.stringify({ loanId: loan.id, officerId: loan.officerId, gearName: loan.gear.name }),
                ipAddress: req.ip
            }
        });

        res.json(updatedLoan);
    } catch (error) {
        console.error('Failed to return gear:', error);
        res.status(500).json({ message: 'Failed to process equipment return' });
    }
};

// 5. Get Gear Loans List
export const getGearLoans = async (req: AuthRequest, res: Response) => {
    const { status, officerId } = req.query;

    try {
        const filters: any = {};
        if (status) filters.status = String(status);
        if (officerId) filters.officerId = String(officerId);

        const loans = await prisma.securityGearLoan.findMany({
            where: filters,
            include: {
                gear: true,
                officer: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: { loanedAt: 'desc' }
        });

        res.json(loans);
    } catch (error) {
        console.error('Failed to fetch gear loans:', error);
        res.status(500).json({ message: 'Failed to fetch equipment loans log' });
    }
};
