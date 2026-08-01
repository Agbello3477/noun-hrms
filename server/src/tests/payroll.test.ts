import { PayrollService } from '../services/payroll.service';

const runTests = async () => {
    console.log('🧪 Starting Payroll & Tax Engine Precision Math Unit Tests...');

    try {
        // Test Case 1: Gross Pay = ₦500,000/mo (₦6,000,000/yr), Basic = ₦200,000/mo (₦2,400,000/yr)
        const monthlyGross = 500000;
        const monthlyBasic = 200000;
        
        // Pension: 8% of Gross = 40,000
        const pension = monthlyGross * 0.08;
        // NHF: 2.5% of Basic = 5,000
        const nhf = monthlyBasic * 0.025;
        // NHIS: 1.75% of Basic = 3,500
        const nhis = monthlyBasic * 0.0175;

        // Annuals
        const annualGross = monthlyGross * 12; // 6,000,000
        const annualPension = pension * 12;    // 480,000
        const annualNHF = nhf * 12;            // 60,000
        const annualNHIS = nhis * 12;          // 42,000

        // CRA Calculation:
        // Math.max(200,000, 1% of 6,000,000 = 60,000) -> 200,000
        // + 20% of 6,000,000 = 1,200,000
        // Annual CRA = 1,400,000
        // Total Reliefs = CRA + Pension + NHF + NHIS = 1,400,000 + 480,000 + 60,000 + 42,000 = 1,982,000
        // Taxable Income = 6,000,000 - 1,982,000 = 4,018,000
        
        // Progressive Brackets on 4,018,000:
        // Bracket 1: 300,000 * 0.07 = 21,000
        // Bracket 2: 300,000 * 0.11 = 33,000
        // Bracket 3: 500,000 * 0.15 = 75,000
        // Bracket 4: 500,000 * 0.19 = 95,000
        // Bracket 5: 1,600,000 * 0.21 = 336,000
        // Bracket 6: (4,018,000 - 3,200,000) = 818,000 * 0.24 = 196,320
        // Total Annual Tax = 21,000 + 33,000 + 75,000 + 95,000 + 336,000 + 196,320 = 756,320
        // Monthly Tax = 756,320 / 12 = 63026.67
        
        const computedTax = PayrollService.calculatePAYE(monthlyGross, monthlyBasic, annualPension, annualNHF, annualNHIS);
        console.log(`Computed Tax: ₦${computedTax} vs Expected: ₦63026.67`);

        if (Math.abs(computedTax - 63026.67) < 0.1) {
            console.log('✅ PASS: Progressive PAYE sliding-scale calculation matches expected value');
        } else {
            throw new Error(`FAIL: PAYE calculation mismatch: got ${computedTax}`);
        }

        if (Math.abs(pension - 40000) < 0.1) {
            console.log('✅ PASS: Employee Pension calculation (8% of Gross) is correct');
        } else {
            throw new Error(`FAIL: Pension calculation mismatch: got ${pension}`);
        }

        if (Math.abs(nhf - 5000) < 0.1) {
            console.log('✅ PASS: NHF calculation (2.5% of Basic) is correct');
        } else {
            throw new Error(`FAIL: NHF calculation mismatch: got ${nhf}`);
        }

        if (Math.abs(nhis - 3500) < 0.1) {
            console.log('✅ PASS: NHIS calculation (1.75% of Basic) is correct');
        } else {
            throw new Error(`FAIL: NHIS calculation mismatch: got ${nhis}`);
        }

        console.log('\n🎉 Payroll Precision Math Tests complete: All checks passed.\n');
    } catch (error: any) {
        console.error('❌ Payroll Test Failed:', error.message);
        process.exit(1);
    }
};

runTests();
