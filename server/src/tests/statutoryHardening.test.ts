import prisma from '../prisma';
import { ConfirmationStatus, TrainingType, ResettlementBursaryStatus } from '@prisma/client';
import { ProbationConfirmationService } from '../services/ProbationConfirmationService';
import { DisciplinaryPayrollService } from '../services/DisciplinaryPayrollService';
import { TrainingBondGuard } from '../services/TrainingBondGuard';
import { AdminPromotionEvaluator } from '../services/AdminPromotionEvaluator';
import { PostingAllowanceEngine } from '../services/PostingAllowanceEngine';
import { SpousalDeploymentGuard } from '../services/SpousalDeploymentGuard';
import { calculatePromotionMaturity } from '../utils/promotionCalculator';

const runTests = async () => {
    console.log('🏛️ Starting NOUN Statutory Compliance & Cadre Policy Hardening Tests...\n');

    let passedTests = 0;
    const totalTests = 7;

    try {
        // =========================================================================
        // TEST 1: Unconfirmed staff cannot apply for study leave or submit promotion application
        // =========================================================================
        console.log('🧪 TEST 1: Unconfirmed staff (ON_PROBATION) blocked from promotion and study leave...');
        
        const unconfirmedStaff = {
            confirmationStatus: ConfirmationStatus.ON_PROBATION
        };
        const confirmedStaff = {
            confirmationStatus: ConfirmationStatus.CONFIRMED
        };

        const promoCheckUnconfirmed = ProbationConfirmationService.validatePromotionPrerequisites(unconfirmedStaff);
        const promoCheckConfirmed = ProbationConfirmationService.validatePromotionPrerequisites(confirmedStaff);

        const studyCheckUnconfirmed = ProbationConfirmationService.validateLeavePrerequisites(unconfirmedStaff, 'STUDY');
        const studyCheckConfirmed = ProbationConfirmationService.validateLeavePrerequisites(confirmedStaff, 'STUDY');

        if (
            !promoCheckUnconfirmed.valid &&
            promoCheckUnconfirmed.message === 'Promotion requires confirmed appointment' &&
            promoCheckConfirmed.valid &&
            !studyCheckUnconfirmed.valid &&
            studyCheckUnconfirmed.message === 'Study and Training leave requires confirmed appointment' &&
            studyCheckConfirmed.valid
        ) {
            console.log('✅ PASS: Both Promotion and Study Leave strictly require confirmed appointment.');
            passedTests++;
        } else {
            throw new Error(`FAIL: Test 1 failed. Promo check: ${JSON.stringify(promoCheckUnconfirmed)}, Study check: ${JSON.stringify(studyCheckUnconfirmed)}`);
        }

        // =========================================================================
        // TEST 2: Staff on probation for 36 months without confirmation is flagged for termination
        // =========================================================================
        console.log('\n🧪 TEST 2: Probation duration threshold evaluator (2-yr appraisal vs 3-yr termination drop)...');
        
        const now = new Date();
        const threeYearsAndOneMonthAgo = new Date(now.getTime() - (37 * 30.5 * 24 * 60 * 60 * 1000));
        const twoYearsAndOneMonthAgo = new Date(now.getTime() - (25 * 30.5 * 24 * 60 * 60 * 1000));
        
        let flaggedForTerminationId = '';
        (prisma.staffProfile as any).findMany = async (args: any) => {
            return [
                {
                    id: 'staff-over-3yrs',
                    staffId: 'NOUN/PB/002',
                    confirmationStatus: ConfirmationStatus.ON_PROBATION,
                    probationStartDate: threeYearsAndOneMonthAgo,
                    unitId: 'unit-1',
                    unit: { id: 'unit-1', name: 'Registry', headId: 'hod-1' },
                    user: { name: 'Exceeded Probation Staff' }
                },
                {
                    id: 'staff-2-3yrs',
                    staffId: 'NOUN/PB/003',
                    confirmationStatus: ConfirmationStatus.ON_PROBATION,
                    probationStartDate: twoYearsAndOneMonthAgo,
                    unitId: 'unit-1',
                    unit: { id: 'unit-1', name: 'Registry', headId: 'hod-1' },
                    user: { name: 'Due Probation Staff' }
                }
            ];
        };

        (prisma.user as any).findMany = async () => [{ id: 'registrar-1' }];
        (prisma.notification as any).create = async () => ({ id: 'notif-1' });
        (prisma.unit as any).findUnique = async (args: any) => ({ id: args.where.id, name: 'Registry', headId: 'hod-1' });

        (prisma.staffProfile as any).update = async (args: any) => {
            if (args.where?.id === 'staff-over-3yrs' && args.data?.confirmationStatus === ConfirmationStatus.TERMINATION_RECOMMENDED) {
                flaggedForTerminationId = args.where.id;
            }
            return { id: args.where.id, ...args.data };
        };

        const probationResult = await ProbationConfirmationService.evaluateProbationStatus(now);
        if (
            flaggedForTerminationId === 'staff-over-3yrs' &&
            probationResult.hardDropFlagged === 1 &&
            probationResult.dueForAppraisal === 1
        ) {
            console.log('✅ PASS: 3-year overdue probation transitioned to TERMINATION_RECOMMENDED (Hard Drop Rule).');
            passedTests++;
        } else {
            throw new Error(`FAIL: Test 2 failed. Hard drop flagged: ${probationResult.hardDropFlagged}, Due: ${probationResult.dueForAppraisal}`);
        }

        // =========================================================================
        // TEST 3: Authorized suspension applies 0.5 multiplier and routes held funds; exoneration creates arrears batch
        // =========================================================================
        console.log('\n🧪 TEST 3: Disciplinary payroll (50% deduction, HeldEmolumentsLedger, Exoneration vs Forfeiture)...');
        
        let createdLedgerRecord: any = null;
        (prisma.heldEmolumentsLedger as any).findFirst = async () => null;
        (prisma.heldEmolumentsLedger as any).create = async (args: any) => {
            createdLedgerRecord = { id: 'ledger-001', ...args.data };
            return createdLedgerRecord;
        };

        // 1. Record 50% held salary during suspension
        const heldRecord = await DisciplinaryPayrollService.recordHeldEmolument({
            staffProfileId: 'staff-disc-001',
            month: '10',
            year: 2026,
            grossSalary: 500000,
            sanctionType: 'SUSPENSION'
        });

        if (
            Number(heldRecord.heldAmount) === 250000 &&
            Number(heldRecord.disbursedAmount) === 250000 &&
            heldRecord.sanctionType === 'SUSPENSION'
        ) {
            console.log('  -> Held emolument ledger created with 50% salary (250,000 NGN).');
        } else {
            throw new Error('FAIL: Held emoluments ledger failed to record 50% deduction.');
        }

        // 2. Exoneration verdict creates arrears refund
        const mockStaffDisc = {
            id: 'staff-disc-001',
            staffId: 'NOUN/DSC/001',
            userId: 'user-disc-001',
            isDisciplinarySuspended: true,
            isDisciplinaryInterdicted: false,
            user: { id: 'user-disc-001', name: 'Exonerated Staff' }
        };
        (prisma.staffProfile as any).findUnique = async (args: any) => mockStaffDisc;
        (prisma.staffProfile as any).findFirst = async (args: any) => mockStaffDisc;

        (prisma.heldEmolumentsLedger as any).findMany = async () => [
            { id: 'ledger-001', staffProfileId: 'staff-disc-001', heldAmount: 250000, status: 'HELD' }
        ];

        let updatedHeldStatus = '';
        (prisma.heldEmolumentsLedger as any).updateMany = async (args: any) => {
            updatedHeldStatus = args.data.status;
            return { count: 1 };
        };

        const exonerationResult = await DisciplinaryPayrollService.resolveVerdict(
            'staff-disc-001',
            'EXONERATED',
            'registrar-uuid',
            'REG/DISC/2026/EX-01'
        );

        if (
            exonerationResult.arrearsBatch?.totalRefundAmount === 250000 &&
            exonerationResult.arrearsBatch?.status === 'BURSARY_ARREARS_PAYOUT_BATCH_GENERATED' &&
            updatedHeldStatus === 'REFUNDED_ARREARS'
        ) {
            console.log('✅ PASS: Suspension 50% deduction recorded and 100% arrears batch generated on Exoneration.');
            passedTests++;
        } else {
            throw new Error(`FAIL: Test 3 failed to process exoneration arrears batch: ${JSON.stringify(exonerationResult)}`);
        }

        // =========================================================================
        // TEST 4: Active training bond causes restriction on resignation, withdrawal, and leave of absence
        // =========================================================================
        console.log('\n🧪 TEST 4: Training bond custody & exit/leave interlocking...');
        
        // 1. Calculate bond duration: 2x for full time (max 5), 1x for part time (max 3-5)
        const fullTimeBond3Yrs = TrainingBondGuard.calculateBondDuration(TrainingType.FULL_TIME_SPONSORED, 3); // 3*2 = 6 -> capped at 5
        const fullTimeBond2Yrs = TrainingBondGuard.calculateBondDuration(TrainingType.FULL_TIME_SPONSORED, 2); // 2*2 = 4
        const partTimeBond2Yrs = TrainingBondGuard.calculateBondDuration(TrainingType.PART_TIME_SPONSORED, 2); // 2*1 = 2

        if (fullTimeBond3Yrs !== 5 || fullTimeBond2Yrs !== 4 || partTimeBond2Yrs !== 2) {
            throw new Error(`FAIL: Bond duration calculation failed. Expected [5, 4, 2], got [${fullTimeBond3Yrs}, ${fullTimeBond2Yrs}, ${partTimeBond2Yrs}]`);
        }

        // 2. Active bond blocks exit and leave of absence
        const bondedStaffId = 'staff-bonded-001';
        (prisma.trainingBondRecord as any).findFirst = async (args: any) => {
            if (args.where?.staffProfileId === bondedStaffId && args.where?.isBondDischarged === false) {
                return {
                    id: 'bond-001',
                    staffProfileId: bondedStaffId,
                    trainingType: TrainingType.FULL_TIME_SPONSORED,
                    bondDurationYears: 4,
                    bondStartDate: new Date('2024-01-01'),
                    bondEndDate: new Date('2028-01-01'),
                    isBondDischarged: false,
                    totalFinancialIndemnity: 5000000
                };
            }
            return null;
        };

        const resignCheck = await TrainingBondGuard.checkActiveBond(bondedStaffId, 'RESIGN');
        const withdrawCheck = await TrainingBondGuard.checkActiveBond(bondedStaffId, 'WITHDRAW');
        const leaveCheck = await TrainingBondGuard.checkActiveBond(bondedStaffId, 'LEAVE_OF_ABSENCE');

        if (
            resignCheck.hasActiveBond &&
            resignCheck.error === 'ACTIVE_TRAINING_BOND_RESTRICTION' &&
            withdrawCheck.hasActiveBond &&
            withdrawCheck.error === 'ACTIVE_TRAINING_BOND_RESTRICTION' &&
            leaveCheck.hasActiveBond &&
            leaveCheck.error === 'ACTIVE_TRAINING_BOND_RESTRICTION'
        ) {
            console.log('✅ PASS: Active training bond strictly blocks resignation, withdrawal, and leave of absence.');
            passedTests++;
        } else {
            throw new Error(`FAIL: Test 4 failed. Resign check: ${JSON.stringify(resignCheck)}`);
        }

        // =========================================================================
        // TEST 5: Cadre promotion waiting period (CONTISS 11 = 4 yrs; CONUASS 04 = 3 yrs; CONTISS 14 = vacancy lock)
        // =========================================================================
        console.log('\n🧪 TEST 5: Cadre-specific promotion waiting periods & executive vacancy locks...');
        
        const threeYearsAgoDate = new Date();
        threeYearsAgoDate.setFullYear(threeYearsAgoDate.getFullYear() - 3);

        // CONTISS 11 with 3 years (Should require 4 years)
        const contiss11Maturity = calculatePromotionMaturity(threeYearsAgoDate, 'ADMINISTRATIVE', 'CONTISS 11', 'Senior Assistant Registrar');
        
        // CONUASS 04 with 3 years (Should require 3 years)
        const conuass04Maturity = calculatePromotionMaturity(threeYearsAgoDate, 'ACADEMIC', 'CONUASS 04', 'Senior Lecturer');
        
        // CONTISS 07 with 3 years (Should require 3 years)
        const contiss07Maturity = calculatePromotionMaturity(threeYearsAgoDate, 'ADMINISTRATIVE', 'CONTISS 07', 'Administrative Officer II');

        if (
            contiss11Maturity.intervalYears === 4 &&
            conuass04Maturity.intervalYears === 3 &&
            contiss07Maturity.intervalYears === 3
        ) {
            console.log('  -> Waiting periods verified: CONTISS 11 (4 yrs); CONUASS 04 (3 yrs); CONTISS 07 (3 yrs).');
        } else {
            throw new Error(`FAIL: Cadre statutory waiting periods calculation mismatch: CONTISS 11=${contiss11Maturity.intervalYears}, CONUASS 04=${conuass04Maturity.intervalYears}, CONTISS 07=${contiss07Maturity.intervalYears}`);
        }

        // CONTISS 14 Vacancy Lock check
        (prisma.institutionalVacancy as any).findFirst = async () => null;

        const contiss14Staff = {
            id: 'staff-deputy-001',
            rank: 'Deputy Registrar',
            level: 'CONTISS 14',
            confirmationStatus: ConfirmationStatus.CONFIRMED,
            lastPromotionDate: new Date('2020-01-01'), // 6 years
            cadre: 'ADMINISTRATIVE'
        };

        const evalResult = await AdminPromotionEvaluator.evaluate(contiss14Staff, 2026);

        const hasVacancyBlock = evalResult.reasons.some(b => b.includes('Institutional Vacancy') || b.includes('locked'));
        if (hasVacancyBlock && evalResult.requiresInstitutionalVacancy && !evalResult.hasDeclaredVacancy && !evalResult.isEligible) {
            console.log('✅ PASS: CONTISS 14 promotion blocked due to lack of declared InstitutionalVacancy.');
            passedTests++;
        } else {
            throw new Error(`FAIL: Test 5 failed. Result: ${JSON.stringify(evalResult)}`);
        }

        // =========================================================================
        // TEST 6: Management posting generates 2% allowance; employee-requested generates 0.00
        // =========================================================================
        console.log('\n🧪 TEST 6: Management posting allowance (2% annual basic emolument calculation)...');
        
        (prisma.staffProfile as any).findUnique = async (args: any) => {
            return {
                id: 'staff-allowance-001',
                annualBasicEmolument: 6000000 // 6,000,000 NGN
            };
        };

        const mgmtClaim = await PostingAllowanceEngine.calculateAllowance('staff-allowance-001', true);
        const ownRequestClaim = await PostingAllowanceEngine.calculateAllowance('staff-allowance-001', false);

        if (
            mgmtClaim.resettlementAllowanceAmount === 120000 &&
            mgmtClaim.isManagementInitiated === true &&
            mgmtClaim.resettlementBursaryStatus === ResettlementBursaryStatus.PENDING_BURSARY_DISBURSEMENT &&
            ownRequestClaim.resettlementAllowanceAmount === 0 &&
            ownRequestClaim.isManagementInitiated === false &&
            ownRequestClaim.resettlementBursaryStatus === ResettlementBursaryStatus.NOT_APPLICABLE
        ) {
            console.log('✅ PASS: Management posting correctly computed 120,000 NGN (2%) and Own-Request computed 0.00 NGN.');
            passedTests++;
        } else {
            throw new Error(`FAIL: Test 6 allowance mismatch. Mgmt: ${mgmtClaim.resettlementAllowanceAmount}, Own: ${ownRequestClaim.resettlementAllowanceAmount}`);
        }

        // =========================================================================
        // TEST 7: Spousal guard blocks posting to spouse's centre without VC waiver
        // =========================================================================
        console.log('\n🧪 TEST 7: Spousal co-location deployment conflict guard (Section 3.8)...');
        
        const staffWithSpouseId = 'staff-husband-001';
        const spouseStaffId = 'staff-wife-002';
        const centreId = 'centre-abuja-01';

        (prisma.staffProfile as any).findUnique = async (args: any) => {
            if (args.where?.id === staffWithSpouseId) {
                return {
                    id: staffWithSpouseId,
                    spouseStaffId: spouseStaffId,
                    spouse: {
                        id: spouseStaffId,
                        centerId: centreId,
                        unitId: 'unit-registry',
                        user: { name: 'Mrs. Wife Staff' },
                        studyCenter: { id: centreId, name: 'Abuja Study Centre' },
                        unit: { id: 'unit-registry', name: 'Registry' }
                    },
                    user: { name: 'Mr. Husband Staff' }
                };
            }
            return null;
        };

        // Conflict check without VC waiver -> conflict flagged, requires VC approval
        const conflictCheck = await SpousalDeploymentGuard.checkConflict({
            staffProfileId: staffWithSpouseId,
            targetCenterId: centreId,
            vcApprovalUrl: null
        });

        // Conflict check WITH VC waiver -> conflict flagged, hasValidVcApproval = true
        const waiverCheck = await SpousalDeploymentGuard.checkConflict({
            staffProfileId: staffWithSpouseId,
            targetCenterId: centreId,
            vcApprovalUrl: 'https://hrms.noun.edu.ng/docs/vc_waivers/VC-WAIVER-2026-001.pdf'
        });

        if (
            conflictCheck.hasConflict &&
            conflictCheck.requiresVcApproval &&
            !conflictCheck.hasValidVcApproval &&
            waiverCheck.hasConflict &&
            waiverCheck.hasValidVcApproval
        ) {
            console.log('✅ PASS: Spousal conflict detected; blocked without VC waiver and permitted with valid VC waiver.');
            passedTests++;
        } else {
            throw new Error(`FAIL: Test 7 failed. Conflict: ${JSON.stringify(conflictCheck)}, Waiver: ${JSON.stringify(waiverCheck)}`);
        }

        console.log(`\n======================================================`);
        console.log(`🎯 ALL ${passedTests}/${totalTests} STATUTORY HARDENING INTEGRATION TESTS PASSED!`);
        console.log(`======================================================\n`);
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Statutory Hardening Integration Test Failed:', error);
        process.exit(1);
    }
};

runTests();
