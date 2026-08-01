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

        // Parse Level/Step to extract numeric values and determine Scale (CONUASS vs CONTISS)
        let scaleName = 'CONTISS';
        if (staff.level.toUpperCase().includes('CONUASS')) {
            scaleName = 'CONUASS';
        }

        const levelMatch = staff.level.match(/\d+/);
        const levelCode = levelMatch ? levelMatch[0].padStart(2, '0') : staff.level;

        const stepMatch = staff.step.match(/\d+/);
        const stepCode = stepMatch ? stepMatch[0].padStart(2, '0') : staff.step;

        // Find scale ID
        const scale = await prisma.salaryScale.findFirst({
            where: { name: scaleName }
        });

        const salaryLevel = await prisma.salaryLevel.findFirst({
            where: {
                scaleId: scale?.id,
                level: levelCode,
                step: stepCode
            }
        });

        if (!salaryLevel) {
            // Fallback to searching without scaleId
            const fallback = await prisma.salaryLevel.findFirst({
                where: {
                    level: levelCode,
                    step: stepCode
                }
            });
            if (!fallback) {
                throw new Error(`No Salary Scale found for Level ${staff.level} Step ${staff.step}`);
            }
            return fallback;
        }

        return salaryLevel;
    }

    /**
     * Complete PAYE calculation engine according to Nigerian Tax Law (PITA Amendment)
     */
    static calculatePAYE(grossIncome: number, basicSalary: number, annualPension: number, annualNHF: number, annualNHIS: number): number {
        const annualGross = grossIncome * 12;
        
        // 1. Consolidated Relief Allowance (CRA)
        // CRA is ₦200,000 or 1% of Gross Income (whichever is higher) + 20% of Gross Income
        const baseRelief = Math.max(200000, annualGross * 0.01);
        const cra = baseRelief + (annualGross * 0.20);
        
        // 2. Tax Reliefs (Pension, NHF, NHIS)
        const totalReliefs = cra + annualPension + annualNHF + annualNHIS;
        
        // 3. Taxable Income
        const taxableIncome = Math.max(0, annualGross - totalReliefs);
        
        // 4. Progressive Tax Brackets
        // First ₦300,000 @ 7%
        // Next ₦300,000 @ 11%
        // Next ₦500,000 @ 15%
        // Next ₦500,000 @ 19%
        // Next ₦1,600,000 @ 21%
        // Above ₦3,200,000 @ 24%
        let remaining = taxableIncome;
        let annualTax = 0;

        if (remaining > 0) {
            const chunk = Math.min(remaining, 300000);
            annualTax += chunk * 0.07;
            remaining -= chunk;
        }
        if (remaining > 0) {
            const chunk = Math.min(remaining, 300000);
            annualTax += chunk * 0.11;
            remaining -= chunk;
        }
        if (remaining > 0) {
            const chunk = Math.min(remaining, 500000);
            annualTax += chunk * 0.15;
            remaining -= chunk;
        }
        if (remaining > 0) {
            const chunk = Math.min(remaining, 500000);
            annualTax += chunk * 0.19;
            remaining -= chunk;
        }
        if (remaining > 0) {
            const chunk = Math.min(remaining, 1600000);
            annualTax += chunk * 0.21;
            remaining -= chunk;
        }
        if (remaining > 0) {
            annualTax += remaining * 0.24;
        }

        const monthlyPAYE = annualTax / 12;
        return Math.round(monthlyPAYE * 100) / 100;
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
                    continue; // Skip already generated
                }

                // Calculate
                let salaryDetails;
                try {
                    salaryDetails = await this.calculateSalary(user.staffProfile.id);
                } catch (e) {
                    errors.push({ user: user.email, error: 'Salary Scale not defined' });
                    continue;
                }

                const { basicSalary, rent, transport, meal, utility, entertainment, consolidated } = salaryDetails;

                // Allowances
                const totalAllowances = rent + transport + meal + utility + entertainment;
                const grossPay = consolidated; 

                // Statutory Deductions (Nigerian Payroll Rules)
                // Pension: 8% of Gross (Employee), Employer pays 10%
                const pension = Math.round((grossPay * 0.08) * 100) / 100;

                // NHF: 2.5% of Basic Salary
                const nhf = Math.round((basicSalary * 0.025) * 100) / 100;

                // NHIS: 1.75% of Basic Salary
                const nhis = Math.round((basicSalary * 0.0175) * 100) / 100;

                // Annual Relief Totals for PAYE Tax Calc
                const annualPension = pension * 12;
                const annualNHF = nhf * 12;
                const annualNHIS = nhis * 12;

                const tax = this.calculatePAYE(grossPay, basicSalary, annualPension, annualNHF, annualNHIS);

                const totalDeductions = Math.round((pension + nhf + nhis + tax) * 100) / 100;
                const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;

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
                        otherDeductions: Math.round((nhf + nhis) * 100) / 100, // NHF + NHIS mapped to otherDeductions
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
            data: { status: 'APPROVED', paymentDate: new Date() }
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
                profile?.bankName || 'Access Bank',
                profile?.accountNumber || '0000000000'
            ].join(',');
        });

        return [header, ...rows].join('\n');
    }

    static async exportBankSchedule(month: string, year: number) {
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

        const header = [
            'Serial Number', 'Employee ID', 'Employee Name',
            'Bank Name', 'Account Number', 'Net Pay', 'Narration'
        ].join(',');

        const rows = records.map((record, index) => {
            const profile = record.user.staffProfile;
            return [
                index + 1,
                record.user.id,
                `"${record.user.name}"`,
                profile?.bankName || 'Access Bank',
                profile?.accountNumber || '0000000000',
                record.netPay,
                `"Salary disbursement for ${month} ${year}"`
            ].join(',');
        });

        return [header, ...rows].join('\n');
    }
}
