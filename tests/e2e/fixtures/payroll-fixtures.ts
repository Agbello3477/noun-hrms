export interface StaffPayrollCalculation {
  staffId: string;
  staffName: string;
  cadre: string;
  level: number;
  step: number;
  basicSalary: number;
  allowances: {
    hazard?: number;
    callDuty?: number;
    transport?: number;
    housing?: number;
  };
  grossPay: number;
  deductions: {
    payeTax: number;
    pension: number; // 8% of Basic + Housing + Transport
    nhf: number;     // 2.5% of Basic
  };
  totalDeductions: number;
  netPay: number;
}

export const MOCK_PAYROLL_BATCH = {
  month: 'October',
  year: 2026,
  status: 'PROCESSED',
  details: {
    processed: 250,
    skipped: 0,
    totalGrossPay: 87500000.00,
    totalTax: 12250000.00,
    totalPension: 7000000.00,
    totalDeductions: 19250000.00,
    totalNetPay: 68250000.00
  },
  sampleStaffCalculations: [
    {
      staffId: 'STAFF/ACAD/0101',
      staffName: 'Prof. Babatunde Alabi',
      cadre: 'CONUASS',
      level: 7,
      step: 10,
      basicSalary: 450000.00,
      allowances: {
        hazard: 50000.00,
        callDuty: 0.00,
        transport: 40000.00,
        housing: 60000.00
      },
      grossPay: 600000.00,
      deductions: {
        payeTax: 84000.00,
        pension: 44000.00, // 8% of (450k + 60k + 40k)
        nhf: 11250.00     // 2.5% of 450k
      },
      totalDeductions: 139250.00,
      netPay: 460750.00
    },
    {
      staffId: 'STAFF/MED/0202',
      staffName: 'Dr. Amina Yusuf',
      cadre: 'CONMESS',
      level: 5,
      step: 4,
      basicSalary: 380000.00,
      allowances: {
        hazard: 65000.00,
        callDuty: 55000.00,
        transport: 30000.00,
        housing: 50000.00
      },
      grossPay: 580000.00,
      deductions: {
        payeTax: 78000.00,
        pension: 36800.00,
        nhf: 9500.00
      },
      totalDeductions: 124300.00,
      netPay: 455700.00
    }
  ] as StaffPayrollCalculation[]
};

/**
 * Calculates payroll components deterministically using high-precision integer arithmetic
 * to eliminate floating-point rounding errors (e.g. 0.1 + 0.2 !== 0.3).
 */
export function calculatePayrollPrecision(
  basic: number,
  allowancesTotal: number,
  taxRatePercent: number = 14,
  pensionRatePercent: number = 8,
  nhfRatePercent: number = 2.5
): {
  grossPay: number;
  payeTax: number;
  pension: number;
  nhf: number;
  totalDeductions: number;
  netPay: number;
} {
  // Convert all currencies to kobo / cents (integers)
  const basicKobo = Math.round(basic * 100);
  const allowancesKobo = Math.round(allowancesTotal * 100);
  const grossKobo = basicKobo + allowancesKobo;

  const taxKobo = Math.round((grossKobo * taxRatePercent) / 100);
  const pensionKobo = Math.round((basicKobo * pensionRatePercent) / 100);
  const nhfKobo = Math.round((basicKobo * nhfRatePercent) / 100);

  const totalDeductionsKobo = taxKobo + pensionKobo + nhfKobo;
  const netKobo = grossKobo - totalDeductionsKobo;

  return {
    grossPay: grossKobo / 100,
    payeTax: taxKobo / 100,
    pension: pensionKobo / 100,
    nhf: nhfKobo / 100,
    totalDeductions: totalDeductionsKobo / 100,
    netPay: netKobo / 100
  };
}
