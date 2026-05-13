import { Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { PayrollService } from '../services/payroll.service';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
    user?: { id: string; role: Role };
}

// 6. Export IPPIS CSV
export const exportIPPISData = async (req: AuthRequest, res: Response) => {
    try {
        const { month, year } = req.body; // or query params? Body for post seems fine
        if (!month || !year) return res.status(400).json({ message: 'Month and Year required' });

        const csvData = await PayrollService.exportIPPIS(month, Number(year));

        // Set Headers for Download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=ippis_${month}_${year}.csv`);

        res.status(200).send(csvData);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: error.message || 'Export failed' });
    }
};

// 1. Run Payroll (Admin/Bursary)
export const runPayroll = async (req: AuthRequest, res: Response) => {
    try {
        const { month, year } = req.body;

        if (!month || !year) {
            return res.status(400).json({ message: 'Month and Year are required' });
        }

        const result = await PayrollService.generateMonthlyPayroll(month, Number(year), req.user!.id);

        res.json({
            message: 'Payroll run processed',
            details: result
        });
    } catch (error: any) {
        console.error('Run Payroll Error:', error);
        res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};

// 2. Get Stats (Admin/Bursary)
export const getPayrollStats = async (req: AuthRequest, res: Response) => {
    try {
        const currentYear = new Date().getFullYear();

        // Aggregate by month for the current year
        const stats = await prisma.payroll.groupBy({
            by: ['month'],
            where: { year: currentYear },
            _sum: {
                netPay: true,
                totalDeductions: true,
                grossPay: true
            },
            orderBy: {
                // Month sorting is tricky with strings, need careful handling or switch to int month
                // For now, relies on string order
                month: 'asc'
            }
        });

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stats' });
    }
};

// 3. Get My Payslips
export const getMyPayslips = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const payslips = await prisma.payroll.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(payslips);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching payslips' });
    }
};

// 4. Get All Payroll Records (For specific month/year)
export const getPayrollRecords = async (req: AuthRequest, res: Response) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) {
            return res.status(400).json({ message: 'Month and Year required' });
        }

        const records = await prisma.payroll.findMany({
            where: {
                month: String(month),
                year: Number(year)
            },
            include: { user: { select: { name: true, email: true } } },
            orderBy: { user: { name: 'asc' } }
        });

        res.json(records);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching records' });
    }
};

// 4b. Get Pending Payroll Records (For Audit)
export const getPendingPayroll = async (req: AuthRequest, res: Response) => {
    try {
        const records = await prisma.payroll.findMany({
            where: { status: 'PENDING' },
            include: { user: { select: { name: true, email: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(records);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching pending payroll' });
    }
};

// 5. Approve Payroll
export const approvePayrollRun = async (req: AuthRequest, res: Response) => {
    try {
        const { month, year, recordIds } = req.body;

        if (recordIds && Array.isArray(recordIds)) {
            // Batch approve specific IDs
            await prisma.payroll.updateMany({
                where: { id: { in: recordIds } },
                data: { status: 'PAID', paymentDate: new Date() }
            });
            return res.json({ message: `${recordIds.length} records approved` });
        }

        if (month && year) {
            // Approve whole batch
            await PayrollService.approvePayroll(month, Number(year));
            return res.json({ message: 'Payroll run approved' });
        }

        res.status(400).json({ message: 'Month/Year or recordIds required' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error approving payroll' });
    }
};
