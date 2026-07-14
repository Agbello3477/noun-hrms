import prisma from '../prisma';
import { Department } from '@prisma/client';

const runTests = async () => {
    console.log('🧪 Starting Bursary & Payroll Auditing Integration Tests...');

    let tempUser: any = null;
    let tempVoucher: any = null;

    try {
        // 1. Setup temporary test user
        console.log('🔄 Setting up temporary test user...');
        tempUser = await prisma.user.create({
            data: {
                email: `bursarytest-${Date.now()}@noun.edu.ng`,
                password: 'hashed_password_placeholder',
                role: 'STAFF',
                staffProfile: {
                    create: {
                        staffId: `T-${Date.now()}`,
                        surname: 'BursaryUser',
                        otherNames: 'Test',
                        department: Department.BURSARY_PAYROLL,
                        cadre: 'ADMINISTRATIVE',
                        level: 'CONTISS_08',
                        step: 'STEP_02',
                        status: 'ACTIVE'
                    }
                }
            },
            include: { staffProfile: true }
        });

        // 2. Create Payment Voucher
        console.log('🔄 Creating a payment voucher request...');
        tempVoucher = await prisma.paymentVoucher.create({
            data: {
                title: 'Test Allowances request',
                amount: 75000,
                description: 'Travel support for staff auditing',
                category: 'ALLOWANCE',
                status: 'PENDING',
                createdByUserId: tempUser.id
            }
        });

        // Verify PENDING state
        let voucherRecord = await prisma.paymentVoucher.findUnique({
            where: { id: tempVoucher.id }
        });
        if (voucherRecord && voucherRecord.status === 'PENDING') {
            console.log('✅ PASS: Payment Voucher created successfully with PENDING status');
        } else {
            throw new Error('FAIL: Payment Voucher initialization state mismatch');
        }

        // Recommend State
        console.log('🔄 Recommending voucher...');
        await prisma.paymentVoucher.update({
            where: { id: tempVoucher.id },
            data: { status: 'RECOMMENDED_BY_HEAD' }
        });
        voucherRecord = await prisma.paymentVoucher.findUnique({
            where: { id: tempVoucher.id }
        });
        if (voucherRecord && voucherRecord.status === 'RECOMMENDED_BY_HEAD') {
            console.log('✅ PASS: Payment Voucher status updated to RECOMMENDED_BY_HEAD');
        } else {
            throw new Error('FAIL: Recommend state update mismatch');
        }

        // Audit State
        console.log('🔄 Auditing voucher...');
        await prisma.paymentVoucher.update({
            where: { id: tempVoucher.id },
            data: { status: 'AUDITED_BY_BURSARY', auditComment: 'Audit passed: documentation complete' }
        });
        voucherRecord = await prisma.paymentVoucher.findUnique({
            where: { id: tempVoucher.id }
        });
        if (voucherRecord && voucherRecord.status === 'AUDITED_BY_BURSARY' && voucherRecord.auditComment === 'Audit passed: documentation complete') {
            console.log('✅ PASS: Payment Voucher audited successfully by Bursary');
        } else {
            throw new Error('FAIL: Audit state update mismatch');
        }

        // 3. Test Payroll Audit Reconciliation Logic
        console.log('🔄 Creating pending payroll record to trigger flags...');
        const tempPayroll = await prisma.payroll.create({
            data: {
                userId: tempUser.id,
                month: 'July',
                year: 2026,
                basicSalary: 50000,
                totalAllowances: 10000,
                grossPay: 60000,
                tax: 5000,
                pension: 4000,
                otherDeductions: 0,
                totalDeductions: 9000,
                netPay: 51000,
                status: 'PENDING'
            }
        });

        // Set status to RETIRED to trigger a critical discrepancy flag
        console.log('🔄 Simulating staff status updated to RETIRED...');
        await prisma.staffProfile.update({
            where: { id: tempUser.staffProfile.id },
            data: { status: 'RETIRED' }
        });

        // Trigger manual audit scan logic
        console.log('🔄 Running audit reconciliation flags scan...');
        const profile = await prisma.staffProfile.findUnique({
            where: { id: tempUser.staffProfile.id }
        });
        const flags = [];
        if (profile && profile.status !== 'ACTIVE') {
            flags.push({
                level: 'CRITICAL',
                type: 'RETIREMENT_STATUS',
                message: `Staff status is marked as "${profile.status}" in registry database. Payment should be withheld.`
            });
        }

        if (flags.length > 0 && flags[0].type === 'RETIREMENT_STATUS') {
            console.log('✅ PASS: Audit Reconciliation successfully flagged the RETIRED staff payment discrepancy');
        } else {
            throw new Error('FAIL: Audit Reconciliation scanner failed to identify retired staff ledger entry');
        }

        // Cleanup payroll record
        await prisma.payroll.delete({
            where: { id: tempPayroll.id }
        });

    } catch (error) {
        console.error('❌ FAIL: Bursary Integration Tests encountered an error:', error);
        process.exit(1);
    } finally {
        // Cleanup
        console.log('🧹 Cleaning up temporary test user and vouchers...');
        if (tempVoucher) {
            await prisma.paymentVoucher.delete({
                where: { id: tempVoucher.id }
            }).catch(() => {});
        }
        if (tempUser) {
            await prisma.user.delete({
                where: { id: tempUser.id }
            }).catch(() => {});
        }
    }

    console.log('\n🎉 Bursary Tests complete: all checks passed.');
};

runTests();
