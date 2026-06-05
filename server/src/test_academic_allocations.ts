import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5055/api';

async function main() {
    console.log('--- STARTING TEACHING ALLOCATIONS & COURSES E2E TESTS ---');

    const testStaffEmail = 'test.facilitator@noun.edu.ng';

    // Cleanup old test staff and allocations
    const existingTestUser = await prisma.user.findUnique({
        where: { email: testStaffEmail },
        include: { staffProfile: true }
    });
    if (existingTestUser) {
        if (existingTestUser.staffProfile) {
            await prisma.teachingAllocation.deleteMany({ where: { staffId: existingTestUser.staffProfile.id } });
            await prisma.staffProfile.delete({ where: { id: existingTestUser.staffProfile.id } });
        }
        await prisma.user.delete({ where: { id: existingTestUser.id } });
        console.log('Cleaned up old test user/allocations.');
    }

    // 1. Log in as Dean / Academic Manager (e.g. dean.sciences@noun.edu.ng)
    console.log('\nLogging in Dean of Sciences...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'dean.sciences@noun.edu.ng',
            password: 'password123',
            loginType: 'NV'
        })
    });
    if (!loginRes.ok) {
        throw new Error(`Dean login failed: ${await loginRes.text()}`);
    }
    const deanToken = (await loginRes.json() as { token: string }).token;
    console.log('Dean logged in successfully.');

    // 2. Verify GET /api/academic/courses retrieves auto-seeded courses
    console.log('\nFetching courses list (should trigger auto-seeding if empty)...');
    const coursesRes = await fetch(`${BASE_URL}/academic/courses`, {
        headers: { 'Authorization': `Bearer ${deanToken}` }
    });
    if (!coursesRes.ok) {
        throw new Error(`Failed to fetch courses: ${await coursesRes.text()}`);
    }
    const courses = await coursesRes.json() as any[];
    console.log(`Retrieved ${courses.length} courses from backend.`);
    if (courses.length === 0) {
        throw new Error('Courses list returned empty; auto-seeding failed!');
    }

    // Verify course attributes
    const hasGST107 = courses.some(c => c.code === 'GST107');
    const hasCIT211 = courses.some(c => c.code === 'CIT211');
    if (!hasGST107 || !hasCIT211) {
        throw new Error('Expected default courses (GST107, CIT211) not found in response!');
    }
    console.log('Courses list and auto-seeding validation passed.');

    // 3. Create a facilitator (staff member) to allocate to
    console.log('\nCreating new facilitator staff as Dean...');
    const createRes = await fetch(`${BASE_URL}/staff`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deanToken}`
        },
        body: JSON.stringify({
            surname: 'Facilitator',
            otherNames: 'Academic',
            email: testStaffEmail,
            role: 'STAFF',
            staffId: 'TESTFAC01',
            level: 'CONTISS 7',
            step: '1',
            cadre: 'ACADEMIC',
            phone: '08099991111',
            stateOfOrigin: 'Lagos',
            lga: 'Ikeja',
            address: 'Lagos Study Center Academic Block'
        })
    });
    if (!createRes.ok) {
        throw new Error(`Failed to create facilitator staff: ${await createRes.text()}`);
    }
    const createData = await createRes.json() as any;
    const facilitatorProfileId = createData.user.staffProfile.id;
    const facilitatorUserId = createData.user.id;
    console.log(`Facilitator created successfully. Profile ID: ${facilitatorProfileId}`);

    // 4. Allocate teaching course to the target facilitator
    console.log(`\nAllocating course GST107 to facilitator ${testStaffEmail}...`);
    const allocRes = await fetch(`${BASE_URL}/academic/workload`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deanToken}`
        },
        body: JSON.stringify({
            courseCode: 'GST107',
            session: '2024/2025',
            students: 150,
            staffId: facilitatorProfileId // targeted staff allocation
        })
    });
    if (!allocRes.ok) {
        throw new Error(`Failed to allocate course: ${await allocRes.text()}`);
    }
    const allocation = await allocRes.json() as any;
    console.log('Allocation response:', allocation);
    if (allocation.staffId !== facilitatorProfileId) {
        throw new Error(`Allocation staffId mismatch. Expected ${facilitatorProfileId}, got ${allocation.staffId}`);
    }
    console.log('Allocation created successfully.');

    // 5. Fetch target facilitator's workload and verify allocation is returned
    console.log(`\nFetching workload for target facilitator (staffId: ${facilitatorProfileId})...`);
    const workloadRes = await fetch(`${BASE_URL}/academic/workload?staffId=${facilitatorProfileId}`, {
        headers: { 'Authorization': `Bearer ${deanToken}` }
    });
    if (!workloadRes.ok) {
        throw new Error(`Failed to fetch workload: ${await workloadRes.text()}`);
    }
    const workloadList = await workloadRes.json() as any[];
    console.log(`Facilitator workload list length: ${workloadList.length}`);
    const hasMyAllocation = workloadList.some(w => w.id === allocation.id && w.course?.code === 'GST107');
    if (!hasMyAllocation) {
        throw new Error('Workload query did not return the allocated course for the facilitator.');
    }
    console.log('Facilitator workload verification passed.');

    // 6. Clean up database records
    console.log('\nCleaning up created E2E test staff and allocations...');
    await prisma.teachingAllocation.deleteMany({ where: { staffId: facilitatorProfileId } });
    await prisma.staffProfile.delete({ where: { id: facilitatorProfileId } });
    await prisma.notification.deleteMany({ where: { userId: facilitatorUserId } });
    await prisma.auditLog.deleteMany({ where: { userId: facilitatorUserId } });
    await prisma.user.delete({ where: { id: facilitatorUserId } });
    console.log('Cleanup complete.');

    console.log('\n--- ALL TEACHING ALLOCATIONS & COURSES E2E TESTS COMPLETED SUCCESSFULLY ---');
}

main()
    .catch((err) => {
        console.error('\nE2E Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
