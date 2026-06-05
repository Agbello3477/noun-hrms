import { PrismaClient, QueryStatus } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5055/api';

async function main() {
    console.log('--- STARTING MANAGER QUERIES E2E TESTS ---');

    const testStaffEmail = 'test.queryrecipient@noun.edu.ng';

    // Cleanup old test staff and queries
    const existingTestUser = await prisma.user.findUnique({
        where: { email: testStaffEmail },
        include: { staffProfile: true }
    });
    if (existingTestUser) {
        if (existingTestUser.staffProfile) {
            await prisma.staffQuery.deleteMany({ where: { staffId: existingTestUser.staffProfile.id } });
            await prisma.staffProfile.delete({ where: { id: existingTestUser.staffProfile.id } });
        }
        await prisma.notification.deleteMany({ where: { userId: existingTestUser.id } });
        await prisma.auditLog.deleteMany({ where: { userId: existingTestUser.id } });
        await prisma.user.delete({ where: { id: existingTestUser.id } });
        console.log('Cleaned up old test user/queries.');
    }

    // 1. Log in as Study Center Manager
    console.log('\nLogging in Study Center Manager (Lagos)...');
    const scmLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'studycenter.manager@noun.edu.ng',
            password: 'password123',
            loginType: 'NV'
        })
    });
    if (!scmLoginRes.ok) {
        throw new Error(`SC Manager login failed: ${await scmLoginRes.text()}`);
    }
    const scmToken = (await scmLoginRes.json() as { token: string }).token;
    console.log('SC Manager logged in successfully.');

    // Fetch the SC Manager profile to verify their center placement
    const scmMeRes = await fetch(`${BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${scmToken}` }
    });
    const scmMe = await scmMeRes.json() as any;
    const scmCenterId = scmMe.staffProfile?.centerId;
    console.log(`SC Manager Center Placement ID: ${scmCenterId}`);
    if (!scmCenterId) {
        throw new Error('Study Center Manager is not placed in any center!');
    }

    // 2. Create a staff member under the manager's center
    console.log('\nCreating new staff as SC Manager...');
    const createRes = await fetch(`${BASE_URL}/staff`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${scmToken}`
        },
        body: JSON.stringify({
            surname: 'QueryStaff',
            otherNames: 'Recipient',
            email: testStaffEmail,
            role: 'STAFF',
            staffId: 'TESTQST01',
            level: 'CONTISS 7',
            step: '1',
            cadre: 'ADMINISTRATIVE',
            phone: '08012345678',
            stateOfOrigin: 'Lagos',
            lga: 'Ikeja',
            address: 'Lagos Study Center Road'
        })
    });
    if (!createRes.ok) {
        throw new Error(`Failed to create staff: ${await createRes.text()}`);
    }
    const createData = await createRes.json() as any;
    const createdStaffId = createData.user.id;
    const createdStaffProfileId = createData.user.staffProfile.id;
    console.log(`Staff created successfully. Profile ID: ${createdStaffProfileId}`);

    // 3. Issue a query to the center's staff member (Should Succeed)
    console.log('\nSC Manager issuing query to their staff...');
    const issueRes = await fetch(`${BASE_URL}/queries/issue`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${scmToken}`
        },
        body: JSON.stringify({
            staffId: createdStaffProfileId,
            title: 'Test Disciplinary Query',
            content: 'Please explain your absence on Monday.'
        })
    });
    if (!issueRes.ok) {
        throw new Error(`Failed to issue query to own staff: ${await issueRes.text()}`);
    }
    const queryData = await issueRes.json() as any;
    const queryId = queryData.id;
    console.log(`Query issued successfully. Query ID: ${queryId}`);

    // 4. Attempt to issue a query to an outsider staff member (Should Fail with 403)
    const outsiderStaff = await prisma.user.findUnique({
        where: { email: 'john.doe.test@noun.edu.ng' },
        include: { staffProfile: true }
    });
    if (!outsiderStaff || !outsiderStaff.staffProfile) {
        throw new Error('Outsider staff not found in database.');
    }
    console.log(`\nSC Manager attempting to issue query to outsider staff ${outsiderStaff.email}...`);
    const outsiderIssueRes = await fetch(`${BASE_URL}/queries/issue`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${scmToken}`
        },
        body: JSON.stringify({
            staffId: outsiderStaff.staffProfile.id,
            title: 'Unauthorized Query',
            content: 'This should not work.'
        })
    });
    if (outsiderIssueRes.status !== 403) {
        throw new Error(`Expected 403 Forbidden for outsider query, but got: ${outsiderIssueRes.status}`);
    }
    console.log('Outsider query check passed (returned 403 Forbidden).');

    // 5. Fetch manager's query list and verify it returns the Lagos staff query
    console.log('\nFetching manager queries list...');
    const listRes = await fetch(`${BASE_URL}/queries`, {
        headers: { 'Authorization': `Bearer ${scmToken}` }
    });
    if (!listRes.ok) {
        throw new Error(`Failed to fetch queries: ${await listRes.text()}`);
    }
    const queries = await listRes.json() as any[];
    const hasMyQuery = queries.some(q => q.id === queryId);
    const hasOutsiderQuery = queries.some(q => q.staff?.centerId !== scmCenterId && q.issuedById !== scmMe.id);

    if (!hasMyQuery) {
        throw new Error('Manager queries list did not return the query issued to their own staff.');
    }
    if (hasOutsiderQuery) {
        throw new Error('Manager queries list returned an unauthorized outsider query.');
    }
    console.log('Queries list verification passed.');

    // 6. Log in as the queried staff member and respond to the query
    console.log('\nLogging in queried staff member...');
    const staffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: testStaffEmail,
            password: 'password123',
            loginType: 'NV'
        })
    });
    if (!staffLoginRes.ok) {
        throw new Error(`Staff login failed: ${await staffLoginRes.text()}`);
    }
    const staffToken = (await staffLoginRes.json() as { token: string }).token;
    console.log('Staff logged in successfully.');

    console.log('Staff responding to query...');
    const respondRes = await fetch(`${BASE_URL}/queries/respond`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${staffToken}`
        },
        body: JSON.stringify({
            queryId: queryId,
            responseText: 'I was sick on Monday.'
        })
    });
    if (!respondRes.ok) {
        throw new Error(`Failed to respond to query: ${await respondRes.text()}`);
    }
    console.log('Staff query response submitted.');

    // 7. Log in as SC Manager and resolve the query (Should Succeed)
    console.log('\nSC Manager resolving the query...');
    const resolveRes = await fetch(`${BASE_URL}/queries/${queryId}/resolve`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${scmToken}`
        },
        body: JSON.stringify({ status: 'CLOSED' })
    });
    if (!resolveRes.ok) {
        throw new Error(`Failed to resolve query: ${await resolveRes.text()}`);
    }
    console.log('Query resolved successfully by SC Manager.');

    // Verify query status in database is CLOSED
    const verifiedQuery = await prisma.staffQuery.findUnique({ where: { id: queryId } });
    if (verifiedQuery?.status !== QueryStatus.CLOSED) {
        throw new Error(`Expected query status to be CLOSED, but got: ${verifiedQuery?.status}`);
    }
    console.log('Query status verified as CLOSED in DB.');

    // 8. Verify that managers cannot resolve queries for outsiders
    // Let's seed a dummy query to john.doe.test by a system user
    const sysUser = await prisma.user.findFirst({ where: { role: 'SUPER_USER' } });
    if (!sysUser) {
        throw new Error('No SUPER_USER found in database to seed dummy query.');
    }
    const dummyQuery = await prisma.staffQuery.create({
        data: {
            staffId: outsiderStaff.staffProfile.id,
            issuedById: sysUser.id,
            title: 'Dummy Outsider Query',
            content: 'Dummy Content',
            status: 'OPEN'
        }
    });

    console.log(`\nSC Manager attempting to resolve outsider query ${dummyQuery.id}...`);
    const resolveOutsiderRes = await fetch(`${BASE_URL}/queries/${dummyQuery.id}/resolve`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${scmToken}`
        },
        body: JSON.stringify({ status: 'CLOSED' })
    });

    // Clean up dummy query immediately
    await prisma.staffQuery.delete({ where: { id: dummyQuery.id } });

    if (resolveOutsiderRes.status !== 403) {
        throw new Error(`Expected 403 Forbidden for resolving outsider query, but got: ${resolveOutsiderRes.status}`);
    }
    console.log('Outsider resolve check passed (returned 403 Forbidden).');

    // Clean up Study Center manager test data
    console.log('\nCleaning up Study Center manager test data...');
    await prisma.staffQuery.delete({ where: { id: queryId } });
    await prisma.staffProfile.delete({ where: { id: createdStaffProfileId } });
    await prisma.notification.deleteMany({ where: { userId: createdStaffId } });
    await prisma.auditLog.deleteMany({ where: { userId: createdStaffId } });
    await prisma.user.delete({ where: { id: createdStaffId } });
    console.log('Cleanup of study center manager test complete.');

    // ============================================
    // PART 2: UNIT ADMIN (HEAD OF ADMIN/UNIT) TESTS
    // ============================================
    console.log('\n--- STARTING UNIT ADMIN QUERY E2E TESTS ---');

    const testUnitAdminEmail = 'test.unitadmin@noun.edu.ng';
    const testAdminStaffEmail = 'test.unitadminrecipient@noun.edu.ng';

    const cleanupUnitAdmin = async () => {
        const adminUser = await prisma.user.findUnique({
            where: { email: testUnitAdminEmail },
            include: { staffProfile: true }
        });
        if (adminUser) {
            await prisma.notification.deleteMany({ where: { userId: adminUser.id } });
            await prisma.auditLog.deleteMany({ where: { userId: adminUser.id } });
            if (adminUser.staffProfile) {
                await prisma.staffQuery.deleteMany({ where: { issuedById: adminUser.id } });
                await prisma.staffProfile.delete({ where: { id: adminUser.staffProfile.id } });
            }
            await prisma.user.delete({ where: { id: adminUser.id } });
        }

        const staffUser = await prisma.user.findUnique({
            where: { email: testAdminStaffEmail },
            include: { staffProfile: true }
        });
        if (staffUser) {
            if (staffUser.staffProfile) {
                await prisma.staffQuery.deleteMany({ where: { staffId: staffUser.staffProfile.id } });
                await prisma.staffProfile.delete({ where: { id: staffUser.staffProfile.id } });
            }
            await prisma.notification.deleteMany({ where: { userId: staffUser.id } });
            await prisma.auditLog.deleteMany({ where: { userId: staffUser.id } });
            await prisma.user.delete({ where: { id: staffUser.id } });
        }
    };

    await cleanupUnitAdmin();
    console.log('Cleaned up old Unit Admin test data.');

    // Seed UNIT_ADMIN user
    const bcrypt = require('bcryptjs');
    const hashedPass = await bcrypt.hash('password123', 10);
    const unitAdminUser = await prisma.user.create({
        data: {
            email: testUnitAdminEmail,
            password: hashedPass,
            name: 'Sciences Unit Admin',
            role: 'UNIT_ADMIN',
            staffProfile: {
                create: {
                    level: 'Principal Admin Officer',
                    unitId: 'c07a900a-5c97-4d9e-acbf-cdd212cb713a' // Sciences
                }
            }
        },
        include: { staffProfile: true }
    });
    console.log('Seeded temporary UNIT_ADMIN user.');

    // 1. Log in as Unit Admin
    console.log('\nLogging in Unit Admin (Sciences)...');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: testUnitAdminEmail,
            password: 'password123',
            loginType: 'NV'
        })
    });
    if (!adminLoginRes.ok) {
        throw new Error(`Unit Admin login failed: ${await adminLoginRes.text()}`);
    }
    const adminToken = (await adminLoginRes.json() as { token: string }).token;
    console.log('Unit Admin logged in successfully.');

    // 2. Create staff member under unit
    console.log('\nCreating new staff as Unit Admin...');
    const adminCreateRes = await fetch(`${BASE_URL}/staff`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            surname: 'AdminQueryStaff',
            otherNames: 'Recipient',
            email: testAdminStaffEmail,
            role: 'STAFF',
            staffId: 'TESTQST02',
            level: 'CONTISS 7',
            step: '1',
            cadre: 'ADMINISTRATIVE',
            phone: '08022223333',
            stateOfOrigin: 'Lagos',
            lga: 'Ikeja',
            address: 'Sciences Unit Road'
        })
    });
    if (!adminCreateRes.ok) {
        throw new Error(`Failed to create staff as Unit Admin: ${await adminCreateRes.text()}`);
    }
    const adminCreateData = await adminCreateRes.json() as any;
    const adminStaffProfileId = adminCreateData.user.staffProfile.id;
    const adminStaffUserId = adminCreateData.user.id;
    console.log(`Staff created successfully under Sciences. Profile ID: ${adminStaffProfileId}`);

    // 3. Issue query to unit's staff (Should Succeed)
    console.log('\nUnit Admin issuing query to unit staff...');
    const adminIssueRes = await fetch(`${BASE_URL}/queries/issue`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            staffId: adminStaffProfileId,
            title: 'Sciences Disciplinary Query',
            content: 'Please explain your late report.'
        })
    });
    if (!adminIssueRes.ok) {
        throw new Error(`Failed to issue query as Unit Admin: ${await adminIssueRes.text()}`);
    }
    const adminQueryData = await adminIssueRes.json() as any;
    const adminQueryId = adminQueryData.id;
    console.log(`Query issued successfully. Query ID: ${adminQueryId}`);

    // 4. Try issuing to outsider (Should Fail with 403)
    console.log(`\nUnit Admin attempting to issue query to outsider staff ${outsiderStaff.email}...`);
    const adminOutsiderIssueRes = await fetch(`${BASE_URL}/queries/issue`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            staffId: outsiderStaff.staffProfile.id,
            title: 'Unauthorized Query from Admin',
            content: 'Should fail.'
        })
    });
    if (adminOutsiderIssueRes.status !== 403) {
        throw new Error(`Expected 403 Forbidden for outsider query, but got: ${adminOutsiderIssueRes.status}`);
    }
    console.log('Outsider query check passed (returned 403 Forbidden).');

    // 5. Fetch queries list and verify
    console.log('\nFetching Unit Admin queries list...');
    const adminListRes = await fetch(`${BASE_URL}/queries`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (!adminListRes.ok) {
        throw new Error(`Failed to fetch queries list: ${await adminListRes.text()}`);
    }
    const adminQueriesList = await adminListRes.json() as any[];
    const hasAdminQuery = adminQueriesList.some(q => q.id === adminQueryId);
    if (!hasAdminQuery) {
        throw new Error('Unit Admin queries list did not return the query issued to their own staff.');
    }
    console.log('Queries list verification passed.');

    // 6. Queried staff responds
    console.log('\nLogging in queried unit staff member...');
    const adminStaffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: testAdminStaffEmail,
            password: 'password123',
            loginType: 'NV'
        })
    });
    const adminStaffToken = (await adminStaffLoginRes.json() as { token: string }).token;

    console.log('Staff responding to query...');
    await fetch(`${BASE_URL}/queries/respond`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminStaffToken}`
        },
        body: JSON.stringify({
            queryId: adminQueryId,
            responseText: 'I apologize for the delay.'
        })
    });
    console.log('Staff response submitted.');

    // 7. Unit Admin resolves query
    console.log('\nUnit Admin resolving the query...');
    const adminResolveRes = await fetch(`${BASE_URL}/queries/${adminQueryId}/resolve`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'CLOSED' })
    });
    if (!adminResolveRes.ok) {
        throw new Error(`Failed to resolve query as Unit Admin: ${await adminResolveRes.text()}`);
    }
    console.log('Query resolved successfully by Unit Admin.');

    const adminVerifiedQuery = await prisma.staffQuery.findUnique({ where: { id: adminQueryId } });
    if (adminVerifiedQuery?.status !== QueryStatus.CLOSED) {
        throw new Error(`Expected query status to be CLOSED, but got: ${adminVerifiedQuery?.status}`);
    }
    console.log('Query status verified as CLOSED in DB.');

    // 8. Test copyHR: false (Internal Query) Flow
    console.log('\n--- TESTING INTERNAL ONLY QUERY (copyHR: false) FLOW ---');
    console.log('Unit Admin issuing internal-only query...');
    const internalIssueRes = await fetch(`${BASE_URL}/queries/issue`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            staffId: adminStaffProfileId,
            title: 'Internal Sciences Warning',
            content: 'Please deal with this internally.',
            copyHR: false
        })
    });
    if (!internalIssueRes.ok) {
        throw new Error(`Failed to issue internal query: ${await internalIssueRes.text()}`);
    }
    const internalQueryData = await internalIssueRes.json() as any;
    const internalQueryId = internalQueryData.id;
    console.log(`Internal query issued. ID: ${internalQueryId}`);

    // Verify Unit Admin can see it
    console.log('Verifying Unit Admin can see the internal query...');
    const adminCheckListRes = await fetch(`${BASE_URL}/queries`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const adminCheckList = await adminCheckListRes.json() as any[];
    const adminHasInternal = adminCheckList.some(q => q.id === internalQueryId);
    if (!adminHasInternal) {
        throw new Error('Unit Admin could not see their own issued internal query!');
    }
    console.log('Unit Admin visibility verified.');

    // Verify Recipient Staff can see it
    console.log('Verifying staff recipient can see the internal query...');
    const staffCheckListRes = await fetch(`${BASE_URL}/queries`, {
        headers: { 'Authorization': `Bearer ${adminStaffToken}` }
    });
    const staffCheckList = await staffCheckListRes.json() as any[];
    const staffHasInternal = staffCheckList.some(q => q.id === internalQueryId);
    if (!staffHasInternal) {
        throw new Error('Recipient staff could not see the internal query issued to them!');
    }
    console.log('Staff recipient visibility verified.');

    // Log in as HR Admin (registry@noun.edu.ng)
    console.log('Logging in as HR Admin (Registry)...');
    const hrLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'registry@noun.edu.ng',
            password: 'password123',
            loginType: 'NV'
        })
    });
    if (!hrLoginRes.ok) {
        throw new Error(`HR Admin login failed: ${await hrLoginRes.text()}`);
    }
    const hrToken = (await hrLoginRes.json() as { token: string }).token;
    console.log('HR Admin logged in successfully.');

    // Verify HR Admin CANNOT see the query
    console.log('Verifying HR Admin cannot see the internal query...');
    const hrCheckListRes = await fetch(`${BASE_URL}/queries`, {
        headers: { 'Authorization': `Bearer ${hrToken}` }
    });
    const hrCheckList = await hrCheckListRes.json() as any[];
    const hrHasInternal = hrCheckList.some(q => q.id === internalQueryId);
    if (hrHasInternal) {
        throw new Error('Security Violation: HR Admin was able to see the internal-only query!');
    }
    console.log('HR Admin exclusion verified successfully.');

    // Verify HR Admin gets 403 when trying to resolve it
    console.log('Verifying HR Admin cannot resolve the internal query...');
    const hrResolveRes = await fetch(`${BASE_URL}/queries/${internalQueryId}/resolve`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hrToken}`
        },
        body: JSON.stringify({ status: 'CLOSED' })
    });
    if (hrResolveRes.status !== 403) {
        throw new Error(`Expected 403 Forbidden for HR Admin resolving internal query, but got: ${hrResolveRes.status}`);
    }
    console.log('HR Admin resolve guard verified successfully.');

    // Clean up internal query
    await prisma.staffQuery.delete({ where: { id: internalQueryId } });
    console.log('Cleaned up internal query.');

    // Cleanup dynamic Unit Admin data
    await cleanupUnitAdmin();
    console.log('Cleaned up dynamic Unit Admin test data.');

    console.log('\n--- ALL MANAGER QUERIES E2E TESTS COMPLETED SUCCESSFULLY ---');
}

main()
    .catch((err) => {
        console.error('\nE2E Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
