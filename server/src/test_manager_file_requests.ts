import { PrismaClient, RequestStatus } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5055/api';

async function main() {
    console.log('--- STARTING MANAGER FILE REQUESTS & ANALYTICS E2E TESTS ---');

    const testStaffEmail = 'test.filerequestrecipient@noun.edu.ng';

    // Cleanup old test staff and requests
    const existingTestUser = await prisma.user.findUnique({
        where: { email: testStaffEmail },
        include: { staffProfile: true }
    });
    if (existingTestUser) {
        if (existingTestUser.staffProfile) {
            await prisma.fileRequest.deleteMany({ where: { staffId: existingTestUser.staffProfile.id } });
            await prisma.staffProfile.delete({ where: { id: existingTestUser.staffProfile.id } });
        }
        await prisma.user.delete({ where: { id: existingTestUser.id } });
        console.log('Cleaned up old test user/requests.');
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

    // Fetch the SC Manager profile to verify center placement
    const scmMeRes = await fetch(`${BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${scmToken}` }
    });
    const scmMe = await scmMeRes.json() as any;
    const scmCenterId = scmMe.staffProfile?.centerId;
    console.log(`SC Manager Center Placement ID: ${scmCenterId}`);

    // 2. Verify GET /api/analytics/manager works and returns correct keys
    console.log('\nTesting GET /api/analytics/manager for manager stats...');
    const statsRes = await fetch(`${BASE_URL}/analytics/manager`, {
        headers: { 'Authorization': `Bearer ${scmToken}` }
    });
    if (!statsRes.ok) {
        throw new Error(`Failed to fetch manager stats: ${await statsRes.text()}`);
    }
    const stats = await statsRes.json() as any;
    console.log('Manager Stats response:', stats);

    const requiredKeys = ['totalStaff', 'activeLeaves', 'pendingLeaves', 'pendingAper', 'activeQueries'];
    for (const key of requiredKeys) {
        if (!(key in stats)) {
            throw new Error(`Manager stats response missing required key: ${key}`);
        }
        if (typeof stats[key] !== 'number') {
            throw new Error(`Expected stats[${key}] to be a number, got: ${typeof stats[key]}`);
        }
    }
    console.log('Manager stats endpoint verification passed.');

    // 3. Create a staff member under manager's center to target for file request
    console.log('\nCreating new staff as SC Manager for targeted file request...');
    const createRes = await fetch(`${BASE_URL}/staff`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${scmToken}`
        },
        body: JSON.stringify({
            surname: 'RequestStaff',
            otherNames: 'Recipient',
            email: testStaffEmail,
            role: 'STAFF',
            staffId: 'TESTFRQ01',
            level: 'CONTISS 7',
            step: '1',
            cadre: 'ADMINISTRATIVE',
            phone: '08099998888',
            stateOfOrigin: 'Lagos',
            lga: 'Ikeja',
            address: 'Lagos Study Center Road'
        })
    });
    if (!createRes.ok) {
        throw new Error(`Failed to create staff: ${await createRes.text()}`);
    }
    const createData = await createRes.json() as any;
    const createdStaffProfileId = createData.user.staffProfile.id;
    const createdStaffUserId = createData.user.id;
    console.log(`Staff created successfully. Profile ID: ${createdStaffProfileId}`);

    // 4. Create targeted file request as SC Manager
    console.log('\nSC Manager creating targeted file request...');
    const requestReason = 'Reason: Promotion review | Document Type: Personal File | Urgency: HIGH';
    const reqRes = await fetch(`${BASE_URL}/file-requests/request`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${scmToken}`
        },
        body: JSON.stringify({
            staffId: createdStaffProfileId,
            reason: requestReason
        })
    });
    if (!reqRes.ok) {
        throw new Error(`Failed to create file request: ${await reqRes.text()}`);
    }
    const fileRequest = await reqRes.json() as any;
    const requestId = fileRequest.id;
    console.log(`File request created successfully. ID: ${requestId}`);

    if (fileRequest.staffId !== createdStaffProfileId) {
        throw new Error(`Target staffId mismatch. Expected ${createdStaffProfileId}, got ${fileRequest.staffId}`);
    }
    if (fileRequest.status !== RequestStatus.PENDING) {
        throw new Error(`Expected initial status to be PENDING, got ${fileRequest.status}`);
    }

    // 5. Verify the file request list shows the created request
    console.log('\nFetching file requests list as SC Manager...');
    const listRes = await fetch(`${BASE_URL}/file-requests`, {
        headers: { 'Authorization': `Bearer ${scmToken}` }
    });
    if (!listRes.ok) {
        throw new Error(`Failed to fetch file requests list: ${await listRes.text()}`);
    }
    const requestsList = await listRes.json() as any[];
    const hasMyRequest = requestsList.some(r => r.id === requestId);
    if (!hasMyRequest) {
        throw new Error('Manager could not find the file request they just created in their list.');
    }
    console.log('File request listed successfully.');

    // 6. Log in as HR Admin to process the request
    console.log('\nLogging in HR Admin (Registry)...');
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

    // 7. HR Admin approves request using PUT /api/file-requests/:id/approve
    console.log(`\nHR Admin approving file request ${requestId}...`);
    const approveRes = await fetch(`${BASE_URL}/file-requests/${requestId}/approve`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hrToken}`
        }
    });
    if (!approveRes.ok) {
        throw new Error(`Failed to approve file request: ${await approveRes.text()}`);
    }
    const approvedData = await approveRes.json() as any;
    console.log('Approve response:', approvedData);

    const updatedRequest = await prisma.fileRequest.findUnique({ where: { id: requestId } });
    if (updatedRequest?.status !== RequestStatus.APPROVED) {
        throw new Error(`Expected file request status to be APPROVED in DB, got: ${updatedRequest?.status}`);
    }
    if (!updatedRequest?.accessLink || !updatedRequest?.expiresAt) {
        throw new Error('Approved file request is missing accessLink or expiresAt fields!');
    }
    console.log('File request approved status & access details verified in DB.');

    // 8. Create a second file request to test rejection
    console.log('\nCreating second file request for rejection testing...');
    const reqRes2 = await fetch(`${BASE_URL}/file-requests/request`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${scmToken}`
        },
        body: JSON.stringify({
            staffId: createdStaffProfileId,
            reason: 'Reason: Secondary review'
        })
    });
    if (!reqRes2.ok) {
        throw new Error(`Failed to create second request: ${await reqRes2.text()}`);
    }
    const fileRequest2 = await reqRes2.json() as any;
    const requestId2 = fileRequest2.id;

    // Reject the second request using PUT /api/file-requests/:id/reject
    console.log(`HR Admin rejecting second file request ${requestId2}...`);
    const rejectRes = await fetch(`${BASE_URL}/file-requests/${requestId2}/reject`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hrToken}`
        }
    });
    if (!rejectRes.ok) {
        throw new Error(`Failed to reject file request: ${await rejectRes.text()}`);
    }
    const rejectedData = await rejectRes.json() as any;
    console.log('Reject response:', rejectedData);

    const updatedRequest2 = await prisma.fileRequest.findUnique({ where: { id: requestId2 } });
    if (updatedRequest2?.status !== RequestStatus.REJECTED) {
        throw new Error(`Expected second file request status to be REJECTED in DB, got: ${updatedRequest2?.status}`);
    }
    console.log('File request rejected status verified in DB.');

    // 9. Clean up database records
    console.log('\nCleaning up created E2E test staff and requests...');
    await prisma.fileRequest.deleteMany({ where: { staffId: createdStaffProfileId } });
    await prisma.staffProfile.delete({ where: { id: createdStaffProfileId } });
    await prisma.notification.deleteMany({ where: { userId: createdStaffUserId } });
    await prisma.auditLog.deleteMany({ where: { userId: createdStaffUserId } });
    await prisma.user.delete({ where: { id: createdStaffUserId } });
    console.log('Cleanup complete.');

    console.log('\n--- ALL MANAGER FILE REQUESTS & ANALYTICS E2E TESTS COMPLETED SUCCESSFULLY ---');
}

main()
    .catch((err) => {
        console.error('\nE2E Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
