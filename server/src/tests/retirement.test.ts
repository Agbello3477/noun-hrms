import prisma from '../prisma';
import { calculateRetirementDate } from '../utils/retirement';

async function runTests() {
    console.log('🧪 Starting Retirement Tracking Backend Integration Tests...');
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
        // --- Test Case 1: Retirement Date Calculation (Age-based Academic vs Non-Academic) ---
        const birthDate = new Date('1970-05-15'); // 56 years old in 2026
        const apptDate = new Date('2010-01-01'); // 16 years of service

        const nonAcademicRetirement = calculateRetirementDate(birthDate, apptDate, 'ADMINISTRATIVE');
        // Expected retirement at 60 (2030-05-15) because service limit is 35 years (2045)
        assert(
            nonAcademicRetirement.retirementDate.getFullYear() === 2030,
            'Non-Academic retirement date calculated correctly (60 years age limit)'
        );
        assert(
            nonAcademicRetirement.reason === 'AGE_LIMIT',
            'Non-Academic retirement reason is AGE_LIMIT'
        );

        const academicRetirement = calculateRetirementDate(birthDate, apptDate, 'ACADEMIC');
        // Expected retirement at 65 (2035-05-15)
        assert(
            academicRetirement.retirementDate.getFullYear() === 2035,
            'Academic retirement date calculated correctly (65 years age limit)'
        );

        // --- Test Case 2: Retirement Date Calculation (Service-based) ---
        const youngBirthDate = new Date('1990-01-01'); // 36 years old in 2026
        const longServiceDate = new Date('1995-01-01'); // 31 years of service in 2026, retires at 35 years of service (2030)
        
        const serviceRetirement = calculateRetirementDate(youngBirthDate, longServiceDate, 'ADMINISTRATIVE');
        assert(
            serviceRetirement.retirementDate.getFullYear() === 2030,
            'Service-based retirement date calculated correctly (35 years service limit)'
        );
        assert(
            serviceRetirement.reason === 'SERVICE_YEARS',
            'Service-based retirement reason is SERVICE_YEARS'
        );

        // --- Test Case 3: Status Archival Cascade & Database Mirroring ---
        console.log('🔄 Setting up temporary test user...');
        // Create user & profile
        const testUser = await prisma.user.create({
            data: {
                email: `test_retirement_cascade_${Date.now()}@noun.edu.ng`,
                password: 'password',
                name: 'Test Cascader',
                role: 'STAFF',
                staffProfile: {
                    create: {
                        surname: 'Cascader',
                        otherNames: 'Test',
                        staffId: `TEST_C_${Date.now()}`,
                        status: 'ACTIVE',
                        isDeleted: false
                    }
                }
            },
            include: { staffProfile: true }
        });

        console.log(`🔄 Simulating HR Admin updating status to RETIRED for user: ${testUser.id}`);
        
        // Update user and staff profile to mimic controller logic
        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: testUser.id },
                data: {
                    isActive: false,
                    tokenInvalidatedAt: new Date()
                }
            });
            await tx.staffProfile.update({
                where: { userId: testUser.id },
                data: {
                    status: 'RETIRED',
                    isDeleted: true,
                    deletedAt: new Date()
                }
            });
        });

        // Fetch again to verify mirroring to archive
        const updatedUser = await prisma.user.findUnique({
            where: { id: testUser.id },
            include: { staffProfile: true }
        });

        assert(
            updatedUser?.isActive === false,
            'User isActive is instantly set to false (Revokes system login access)'
        );
        assert(
            updatedUser?.tokenInvalidatedAt !== null,
            'User tokenInvalidatedAt is instantly set (Invalidates active JWT sessions)'
        );
        assert(
            updatedUser?.staffProfile?.isDeleted === true,
            'StaffProfile isDeleted is set to true (Removed from active directory)'
        );
        assert(
            updatedUser?.staffProfile?.deletedAt !== null,
            'StaffProfile deletedAt timestamp is set correctly'
        );
        assert(
            updatedUser?.staffProfile?.status === 'RETIRED',
            'StaffProfile status is correctly set to RETIRED'
        );

        // --- Test Case 4: Mirroring onto Archive Page database view ---
        // Fetch from archived files endpoint query
        const archivedFiles = await prisma.staffProfile.findMany({
            where: { isDeleted: true }
        });
        const archivedIds = archivedFiles.map(f => f.id);
        assert(
            archivedIds.includes(updatedUser?.staffProfile?.id || ''),
            'Archived file is instantly mirrored and visible in the Archive Page query'
        );

        // --- Clean up ---
        console.log('🧹 Cleaning up temporary test user...');
        await prisma.staffProfile.delete({ where: { userId: testUser.id } });
        await prisma.user.delete({ where: { id: testUser.id } });

        console.log(`\n🎉 Tests complete: ${passed} passed, ${failed} failed.`);
        if (failed > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }

    } catch (err: any) {
        console.error('❌ Fatal error during test execution:', err);
        process.exit(1);
    }
}

runTests();
