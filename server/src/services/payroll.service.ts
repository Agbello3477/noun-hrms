import prisma from '../prisma';

export class PayrollService {

    /**
     * Calculate salary components for a staff member based on their Level/Step
     */
    static async calculateSalary(staffId: string) {
        const staff = await prisma.staffProfile.findUnique({
            where: { id: staffId },
            include: { user: true }
        });

        if (!staff || !staff.level || !staff.step) {
            throw new Error(`Staff ${staffId} profile incomplete (Level/Step missing)`);
        }

        // Find matching Salary Level
        // This assumes we have populated SalaryScales (e.g. CONTISS) and linked via naming convention or explicit link.
        // For now, let's search globally across all scales for a match on Level/Step.
        // In a real app, StaffProfile might link directly to a SalaryScale.
        const salaryLevel = await prisma.salaryLevel.findFirst({
            where: {
                level: staff.level,
                step: staff.step
            }
        });

        if (!salaryLevel) {
            throw new Error(`No Salary Scale found for Level ${staff.level} Step ${staff.step}`);
        }

        return salaryLevel;
    }

    /**
     * Generate Payroll for a specific month/year for ALL active staff
     */
    static async generateMonthlyPayroll(month: string, year: number, initiatedByUserId: string) {
        // 1. Get all active staff
        const activeStaff = await prisma.user.findMany({
            where: { isActive: true, role: { not: 'SUPER_USER' } },
            include: { staffProfile: true }
        });

        const createdRecords = [];
        const errors = [];

        for (const user of activeStaff) {
            try {
                if (!user.staffProfile) continue;

                // Check if already generated
                const existing = await prisma.payroll.findFirst({
                    where: { userId: user.id, month, year }
                });

                if (existing) {
                    continue; // Skip or Update? Let's skip for safety.
                }

                // Calculate
                let salaryDetails;
                try {
                    salaryDetails = await this.calculateSalary(user.staffProfile.id);
                } catch (e) {
                    // If no scale found, skip this user but log error
                    // Or maybe generate a zero-pay record?
                    // Let's log and skip.
                    errors.push({ user: user.email, error: 'Salary Scale not defined' });
                    continue;
                }

                const { basicSalary, rent, transport, meal, utility, entertainment, consolidated } = salaryDetails;

                // Allowances
                const totalAllowances = rent + transport + meal + utility + entertainment;
                const grossPay = consolidated; // Should match basic + allowances logic ideally

                // Statutory Deductions (Simplified Rules for Nigeria)
                // Pension: 8% of (Basic + Housing + Transport) usually. 
                // Tax (PAYE): Complex sliding scale. implementing a flat dummy rate for MVP or simplified logic.

                // Simplified Logic: 
                // Pension = 7.5% of Gross (Standard is 8% of BHT, let's use 8% Gross for simplicity or 0 for now)
                const pension = grossPay * 0.08;

                // Tax: Arbitrary 10% for MVP
                const tax = grossPay * 0.10;

                const totalDeductions = pension + tax;
                const netPay = grossPay - totalDeductions;

                const record = await prisma.payroll.create({
                    data: {
                        userId: user.id,
                        month,
                        year,
                        basicSalary,
                        totalAllowances,
                        grossPay,
                        tax,
                        pension,
                        otherDeductions: 0,
                        totalDeductions,
                        netPay,
                        status: 'PENDING'
                    }
                });

                createdRecords.push(record);

            } catch (err: any) {
                errors.push({ user: user.email, error: err.message });
            }
        }

        return {
            processed: createdRecords.length,
            failed: errors.length,
            errors
        };
    }

    static async approvePayroll(month: string, year: number) {
        return prisma.payroll.updateMany({
            where: { month, year },
            data: { status: 'PAID', paymentDate: new Date() }
        });
    }

    // IPPIS Export (CSV Generation)
    static async exportIPPIS(month: string, year: number) {
        const records = await prisma.payroll.findMany({
            where: { month, year },
            include: {
                user: {
                    include: {
                        staffProfile: true
                    }
                }
            }
        });

        if (records.length === 0) {
            throw new Error('No records found for this period');
        }

        // CSV Header
        const header = [
            'Staff ID', 'Name', 'Department', 'IPPIS No.',
            'Grade Level', 'Step',
            'Basic Salary', 'Total Allowances', 'Gross Pay',
            'Tax', 'Pension', 'Total Deductions', 'Net Pay',
            'Bank Name', 'Account Number'
        ].join(',');

        // CSV Rows
        const rows = records.map(record => {
            const profile = record.user.staffProfile;
            return [
                record.user.id,
                `"${record.user.name}"`, // Quote name to handle commas
                profile?.department || 'N/A',
                // specific IPPIS number field isn't in schema yet, using placeholder or staff ID
                profile?.ippisNumber || 'N/A',
                profile?.level || 'N/A',
                profile?.step || 'N/A',
                record.basicSalary,
                record.totalAllowances,
                record.grossPay,
                record.tax,
                record.pension,
                record.totalDeductions,
                record.netPay,
                // Bank details not in schema yet, placeholder
                'Access Bank',
                '0000000000'
            ].join(',');
        });

        return [header, ...rows].join('\n');
    }
}
