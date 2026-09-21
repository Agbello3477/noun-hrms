import prisma from '../prisma';
import { calculatePromotionMaturity, extractGradeLevelNumber } from '../utils/promotionCalculator';
import { PromotionService } from '../services/promotion.service';
import { CadreType, PromotionEligibilityStatus, Role } from '@prisma/client';
import { enableDbMock } from './dbMock';

async function runTests() {
    await enableDbMock();
    console.log('🧪 Starting Staff Promotion Eligibility & Annual Maturity Tracking Tests...');
    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, message: string) => {
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${message}`);
            failed++;
        }
    };

    try {
        // --- Test Case 1: Grade Level Parsing ---
        assert(extractGradeLevelNumber('CONTISS 13/2') === 13, 'Parses CONTISS 13/2 to 13');
        assert(extractGradeLevelNumber('CONUASS 07') === 7, 'Parses CONUASS 07 to 7');
        assert(extractGradeLevelNumber('Level 15') === 15, 'Parses Level 15 to 15');
        assert(extractGradeLevelNumber(null) === null, 'Handles null grade level gracefully');

        // --- Test Case 2: Academic Cadre Interval (3 years, October 1st) ---
        const academicDate = new Date('2023-04-15');
        const academicResult = calculatePromotionMaturity(academicDate, 'ACADEMIC', 'CONUASS 04');
        assert(academicResult.intervalYears === 3, 'Academic interval is 3 years');
        assert(academicResult.nextDueYear === 2026, 'Academic nextDueYear from 2023 is 2026');
        assert(academicResult.nextDueDate.getUTCMonth() === 9, 'Academic nextDueDate is October (month index 9)');
        assert(academicResult.nextDueDate.getUTCDate() === 1, 'Academic nextDueDate is 1st of October');

        // --- Test Case 3: Senior Admin < CONTISS 12 (3 years, January 1st) ---
        const seniorAdminLow = calculatePromotionMaturity(new Date('2023-01-01'), 'SENIOR_ADMIN', 'CONTISS 09');
        assert(seniorAdminLow.intervalYears === 3, 'Senior Admin (CONTISS 09) interval is 3 years');
        assert(seniorAdminLow.nextDueYear === 2026, 'Senior Admin nextDueYear is 2026');
        assert(seniorAdminLow.nextDueDate.getUTCMonth() === 0, 'Senior Admin nextDueDate is January (month index 0)');

        // --- Test Case 4: Senior Admin >= CONTISS 12 (4 years, January 1st) ---
        const seniorAdminHigh = calculatePromotionMaturity(new Date('2022-01-01'), 'SENIOR_ADMIN', 'CONTISS 13');
        assert(seniorAdminHigh.intervalYears === 4, 'Senior Admin (CONTISS 13) interval is 4 years');
        assert(seniorAdminHigh.nextDueYear === 2026, 'Senior Admin (CONTISS 13) nextDueYear from 2022 is 2026');

        // --- Test Case 5: Junior Staff (3 years, January 1st) ---
        const juniorStaff = calculatePromotionMaturity(new Date('2023-06-15'), 'JUNIOR_STAFF', 'CONTISS 03');
        assert(juniorStaff.intervalYears === 3, 'Junior staff interval is 3 years');
        assert(juniorStaff.nextDueYear === 2026, 'Junior staff nextDueYear is 2026');

        // --- Test Case 6: Leap Year / Edge Date Handling ---
        const leapDate = new Date('2024-02-29');
        const leapResult = calculatePromotionMaturity(leapDate, 'TECHNICAL', 'CONTISS 08');
        assert(leapResult.nextDueYear === 2027, 'Leap year Feb 29 date accurately increments to 2027');

        // --- Test Case 7: Database Record Setup & Schedule Override ---
        console.log('🔄 Setting up mock user for promotion workflow verification...');
        const testUser = await prisma.user.create({
            data: {
                email: `promo-test-${Date.now()}@noun.edu.ng`,
                password: 'HashedPassword123!',
                name: 'Dr. Chinedu Okoro',
                role: Role.STAFF
            }
        });

        const adminUser = await prisma.user.create({
            data: {
                email: `registry-admin-${Date.now()}@noun.edu.ng`,
                password: 'HashedPassword123!',
                name: 'Registry Officer Aisha',
                role: Role.HR_ADMIN
            }
        });

        const testProfile = await prisma.staffProfile.create({
            data: {
                userId: testUser.id,
                staffId: `NOUN-P-${Date.now().toString().slice(-5)}`,
                surname: 'Okoro',
                otherNames: 'Chinedu',
                title: 'Dr.',
                rank: 'Senior Lecturer',
                level: 'CONUASS 05',
                cadreType: CadreType.ACADEMIC,
                lastPromotionDate: new Date('2023-10-01'),
                nextDueYear: 2026,
                nextDueDate: new Date('2026-10-01'),
                eligibilityStatus: PromotionEligibilityStatus.PENDING_MATURITY
            }
        });

        // Test schedule override with mandatory audit note
        let overrideFailedWithoutReason = false;
        try {
            await PromotionService.updateStaffPromotionSchedule({
                staffProfileId: testProfile.id,
                actorId: adminUser.id,
                nextDueYear: 2025, // accelerated promotion
                registryOverride: true,
                overrideReason: '   ' // empty reason should fail
            });
        } catch (e: any) {
            overrideFailedWithoutReason = true;
        }
        assert(overrideFailedWithoutReason, 'Schedule override fails when justification note is missing or too short');

        const validOverride = await PromotionService.updateStaffPromotionSchedule({
            staffProfileId: testProfile.id,
            actorId: adminUser.id,
            nextDueYear: 2025,
            registryOverride: true,
            overrideReason: 'Accelerated promotion approved by University Council for outstanding international research grant.'
        });

        assert(validOverride.profile.nextDueYear === 2025, 'Profile updated with overridden due year (2025)');
        assert(validOverride.profile.registryOverride === true, 'Profile marked with registryOverride = true');
        assert(validOverride.auditLog.action === 'MANUAL_OVERRIDE', 'Audit log created with action MANUAL_OVERRIDE');
        assert(validOverride.auditLog.actorId === adminUser.id, 'Audit log records correct registry admin actorId');

        // --- Test Case 8: Disciplinary Screening in Maturity Evaluation ---
        console.log('🔄 Testing integrity screening with open query...');
        await prisma.staffQuery.create({
            data: {
                staffId: testProfile.id,
                issuedById: adminUser.id,
                title: 'Unexplained Absence from Examination Duty',
                content: 'Please explain absence during the 2025/2026 first semester examinations.',
                status: 'OPEN'
            }
        });

        const evalResult = await PromotionService.evaluateMaturityCycle(2026, adminUser.id, 'MANUAL');
        assert(evalResult.integrityHoldsCount >= 1, 'Integrity screening flags candidate with open disciplinary query');

        // Clean up test data
        await prisma.staffQuery.deleteMany({ where: { staffId: testProfile.id } });
        await prisma.promotionAuditLog.deleteMany({ where: { staffProfileId: testProfile.id } });
        await prisma.promotionBatchCandidate.deleteMany({ where: { staffProfileId: testProfile.id } });
        await prisma.promotionLog.deleteMany({ where: { staffProfileId: testProfile.id } });
        await prisma.staffProfile.delete({ where: { id: testProfile.id } }).catch(() => {});
        await prisma.notification.deleteMany({ where: { userId: { in: [testUser.id, adminUser.id] } } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: { in: [testUser.id, adminUser.id] } } });

    } catch (err: any) {
        console.error('Fatal test error:', err);
        failed++;
    }

    console.log(`\n========================================`);
    console.log(`Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
}

runTests();
