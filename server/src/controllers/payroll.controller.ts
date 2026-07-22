import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { PayrollService } from '../services/payroll.service';
import prisma from '../prisma';

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

export const exportBankSchedule = async (req: AuthRequest, res: Response) => {
    try {
        const { month, year } = req.body;
        if (!month || !year) return res.status(400).json({ message: 'Month and Year required' });

        const csvData = await PayrollService.exportBankSchedule(month, Number(year));

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=bank_schedule_${month}_${year}.csv`);

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

export const getAuditReconciliation = async (req: AuthRequest, res: Response) => {
    const { month, year } = req.query;

    try {
        if (!month || !year) {
            return res.status(400).json({ message: 'Month and Year are required' });
        }

        const m = String(month);
        const y = Number(year);

        // Fetch all pending payroll records for that month
        const pendingRecords = await prisma.payroll.findMany({
            where: { month: m, year: y, status: 'PENDING' },
            include: {
                user: {
                    include: {
                        staffProfile: true
                    }
                }
            }
        });

        const reconciliationReports = [];

        // Define start and end dates for query matches
        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        const monthIndex = monthNames.indexOf(m);
        const startOfMonth = new Date(y, monthIndex !== -1 ? monthIndex : 0, 1);
        const endOfMonth = new Date(y, monthIndex !== -1 ? monthIndex + 1 : 1, 0, 23, 59, 59, 999);

        for (const record of pendingRecords) {
            const user = record.user;
            const profile = user.staffProfile;
            const flags = [];

            if (profile) {
                // 1. Retirement/Status checks
                if (profile.status !== 'ACTIVE') {
                    flags.push({
                        level: 'CRITICAL',
                        type: 'RETIREMENT_STATUS',
                        message: `Staff status is marked as "${profile.status}" in registry database. Payment should be withheld.`
                    });
                }

                // 2. Active Leave checks
                const overlappingLeaves = await prisma.leaveRequest.findMany({
                    where: {
                        staffId: profile.id,
                        status: 'APPROVED',
                        OR: [
                            {
                                startDate: { lte: endOfMonth },
                                endDate: { gte: startOfMonth }
                            }
                        ]
                    }
                });

                for (const leave of overlappingLeaves) {
                    flags.push({
                        level: 'WARNING',
                        type: 'ACTIVE_LEAVE',
                        message: `Staff has approved "${leave.type}" leave from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()}.`
                    });
                }
            } else {
                flags.push({
                    level: 'CRITICAL',
                    type: 'MISSING_PROFILE',
                    message: 'Staff profile records are missing or incomplete.'
                });
            }

            // 3. Attendance checks
            const attendanceCount = await prisma.attendance.count({
                where: {
                    userId: user.id,
                    status: 'PRESENT',
                    clockIn: {
                        gte: startOfMonth,
                        lte: endOfMonth
                    }
                }
            });

            if (attendanceCount < 10) {
                flags.push({
                    level: 'WARNING',
                    type: 'LOW_ATTENDANCE',
                    message: `Low attendance. Staff clocked in only ${attendanceCount} times this month (threshold: 10).`
                });
            }

            if (flags.length > 0) {
                reconciliationReports.push({
                    payrollRecordId: record.id,
                    userId: user.id,
                    name: user.name || 'Unknown',
                    email: user.email,
                    staffId: profile?.staffId || 'N/A',
                    grossPay: record.grossPay,
                    netPay: record.netPay,
                    flags
                });
            }
        }

        res.json({
            month: m,
            year: y,
            scannedRecords: pendingRecords.length,
            flaggedCount: reconciliationReports.length,
            reports: reconciliationReports
        });
    } catch (error) {
        console.error('Audit Reconciliation Error:', error);
        res.status(500).json({ message: 'Error running audit reconciliation scan' });
    }
};
