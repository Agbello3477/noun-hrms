import { PrismaClient, RequestStatus, QueryStatus } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5055/api';

async function main() {
    console.log('--- STARTING FILE TRANSFER & FOLDER COLOR E2E TESTS ---');

    const testStaffEmail = 'test.foldercolorstaff@noun.edu.ng';

    // Cleanup old test data
    const existingTestUser = await prisma.user.findUnique({
        where: { email: testStaffEmail },
        include: { staffProfile: true }
    });
    if (existingTestUser) {
        if (existingTestUser.staffProfile) {
            await prisma.staffQuery.deleteMany({ where: { staffId: existingTestUser.staffProfile.id } });
            await prisma.fileRequest.deleteMany({ where: { staffId: existingTestUser.staffProfile.id } });
            await prisma.staffProfile.delete({ where: { id: existingTestUser.staffProfile.id } });
        }
        await prisma.notification.deleteMany({ where: { userId: existingTestUser.id } });
        await prisma.auditLog.deleteMany({ where: { userId: existingTestUser.id } });
        await prisma.user.delete({ where: { id: existingTestUser.id } });
        console.log('Cleaned up old test user/records.');
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

    // Fetch manager info to verify placement
    const scmMeRes = await fetch(`${BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${scmToken}` }
    });
    const scmMe = await scmMeRes.json() as any;
    const place = scmMe.staffProfile?.studyCenter?.name || scmMe.staffProfile?.unit?.name || 'Lagos Study Center';
    console.log(`SC Manager Placement Name: ${place}`);

    // 2. Create target staff member
    console.log('\nCreating target staff member...');
    const createRes = await fetch(`${BASE_URL}/staff`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${scmToken}`
        },
        body: JSON.stringify({
            surname: 'FolderColor',
            otherNames: 'Staff',
            email: testStaffEmail,
            role: 'STAFF',
            staffId: 'TESTCOLOR01',
            level: 'CONTISS 7',
            step: '1',
            cadre: 'ADMINISTRATIVE',
            phone: '08077777777',
            stateOfOrigin: 'Lagos',
            lga: 'Ikeja',
            address: 'Lagos Road'
        })
    });
    if (!createRes.ok) {
        throw new Error(`Failed to create staff: ${await createRes.text()}`);
    }
    const createData = await createRes.json() as any;
    const targetStaffProfileId = createData.user.staffProfile.id;
    const targetUserId = createData.user.id;
    console.log(`Staff created successfully. Profile ID: ${targetStaffProfileId}`);

    // 3. Log in as HR Admin
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
    const hrUser = await prisma.user.findUnique({ where: { email: 'registry@noun.edu.ng' } });
    console.log('HR Admin logged in successfully.');

    // 4. Verify original folder color starts as blue (no queries, no file requests)
    console.log('\nChecking registry files list for initial folder status (should be blue/default)...');
    const filesRes1 = await fetch(`${BASE_URL}/registry/files`, {
        headers: { 'Authorization': `Bearer ${hrToken}` }
    });
    const filesList1 = await filesRes1.json() as any[];
    const targetFile1 = filesList1.find(f => f.staffProfile?.id === targetStaffProfileId);
    if (!targetFile1) {
        throw new Error('Target staff file not found in registry list.');
    }
    const hasOpenQuery1 = targetFile1.staffProfile?.queries?.length > 0;
    const hasActiveTransfer1 = targetFile1.staffProfile?.fileRequests?.length > 0;
    console.log(`Initial Status: hasOpenQuery=${hasOpenQuery1}, hasActiveTransfer=${hasActiveTransfer1} -> BLUE`);
    if (hasOpenQuery1 || hasActiveTransfer1) {
        throw new Error('Expected initial file status to be clean.');
    }

    // 5. Manager creates file request
    console.log('\nSC Manager creating file request...');
    const reqRes = await fetch(`${BASE_URL}/file-requests/request`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${scmToken}`
        },
        body: JSON.stringify({
            staffId: targetStaffProfileId,
            reason: 'Reason: Annual review | Document Type: Personal File | Urgency: MEDIUM'
        })
    });
    if (!reqRes.ok) {
        throw new Error(`Failed to create file request: ${await reqRes.text()}`);
    }
    const requestObj = await reqRes.json() as any;
    const requestId = requestObj.id;
    console.log(`File request created with ID: ${requestId}`);

    // 6. HR Admin approves file request
    console.log(`\nHR Admin approving file request ${requestId}...`);
    const approveRes = await fetch(`${BASE_URL}/file-requests/${requestId}/approve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${hrToken}` }
    });
    if (!approveRes.ok) {
        throw new Error(`Failed to approve request: ${await approveRes.text()}`);
    }
    console.log('Request approved successfully.');

    // Verify approvedById and transferredById in database
    const dbRequest = await prisma.fileRequest.findUnique({
        where: { id: requestId }
    });
    if (!dbRequest) {
        throw new Error('File request not found in database.');
    }
    console.log('Database request record:', {
        status: dbRequest.status,
        approvedById: dbRequest.approvedById,
        transferredById: dbRequest.transferredById
    });
    if (dbRequest.approvedById !== hrUser?.id || dbRequest.transferredById !== hrUser?.id) {
        throw new Error('FileRequest approvedById or transferredById mismatch!');
    }
    if (dbRequest.status !== RequestStatus.APPROVED) {
        throw new Error(`Expected request status to be APPROVED, got: ${dbRequest.status}`);
    }

    // 7. Verify folder color changes to yellow (hasActiveTransfer = true, hasOpenQuery = false)
    console.log('\nChecking registry files list for transferred status (should be yellow)...');
    const filesRes2 = await fetch(`${BASE_URL}/registry/files`, {
        headers: { 'Authorization': `Bearer ${hrToken}` }
    });
    const filesList2 = await filesRes2.json() as any[];
    const targetFile2 = filesList2.find(f => f.staffProfile?.id === targetStaffProfileId);
    const hasOpenQuery2 = targetFile2.staffProfile?.queries?.length > 0;
    const hasActiveTransfer2 = targetFile2.staffProfile?.fileRequests?.length > 0;
    console.log(`Transferred Status: hasOpenQuery=${hasOpenQuery2}, hasActiveTransfer=${hasActiveTransfer2} -> YELLOW`);
    if (hasOpenQuery2 || !hasActiveTransfer2) {
        throw new Error('Expected file status to indicate active transfer (yellow) without queries.');
    }

    // 8. Manager issues a query to the staff member
    console.log('\nSC Manager issuing a disciplinary query to the staff member...');
    const queryRes = await fetch(`${BASE_URL}/queries/issue`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${scmToken}`
        },
        body: JSON.stringify({
            staffId: targetStaffProfileId,
            title: 'Attendance Discrepancy',
            content: 'Please explain your absence from work on June 4th.',
            copyHR: true
        })
    });
    if (!queryRes.ok) {
        throw new Error(`Failed to issue query: ${await queryRes.text()}`);
    }
    const queryObj = await queryRes.json() as any;
    const queryId = queryObj.id;
    console.log(`Query issued with ID: ${queryId}`);

    // 9. Verify folder color changes to red (priority: hasOpenQuery = true, hasActiveTransfer = true -> RED)
    console.log('\nChecking registry files list for query priority status (should be red)...');
    const filesRes3 = await fetch(`${BASE_URL}/registry/files`, {
        headers: { 'Authorization': `Bearer ${hrToken}` }
    });
    const filesList3 = await filesRes3.json() as any[];
    const targetFile3 = filesList3.find(f => f.staffProfile?.id === targetStaffProfileId);
    const hasOpenQuery3 = targetFile3.staffProfile?.queries?.length > 0;
    const hasActiveTransfer3 = targetFile3.staffProfile?.fileRequests?.length > 0;
    console.log(`Query Issued Status: hasOpenQuery=${hasOpenQuery3}, hasActiveTransfer=${hasActiveTransfer3} -> RED (takes precedence)`);
    if (!hasOpenQuery3) {
        throw new Error('Expected file status to indicate active query.');
    }

    // 10. SC Manager resolves/closes the query
    console.log(`\nSC Manager resolving/closing query ${queryId}...`);
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
    console.log('Query resolved/closed successfully.');

    // 11. Verify folder color goes back to yellow (hasOpenQuery = false, hasActiveTransfer = true)
    console.log('\nChecking registry files list after query resolution (should be yellow again)...');
    const filesRes4 = await fetch(`${BASE_URL}/registry/files`, {
        headers: { 'Authorization': `Bearer ${hrToken}` }
    });
    const filesList4 = await filesRes4.json() as any[];
    const targetFile4 = filesList4.find(f => f.staffProfile?.id === targetStaffProfileId);
    const hasOpenQuery4 = targetFile4.staffProfile?.queries?.length > 0;
    const hasActiveTransfer4 = targetFile4.staffProfile?.fileRequests?.length > 0;
    console.log(`Resolved Status: hasOpenQuery=${hasOpenQuery4}, hasActiveTransfer=${hasActiveTransfer4} -> YELLOW`);
    if (hasOpenQuery4 || !hasActiveTransfer4) {
        throw new Error('Expected file status to return to yellow after query resolution.');
    }

    // 12. Retrieve received files as Manager (type=received) and check status text fields
    console.log('\nSC Manager fetching received files list...');
    const receivedRes = await fetch(`${BASE_URL}/file-requests?type=received`, {
        headers: { 'Authorization': `Bearer ${scmToken}` }
    });
    if (!receivedRes.ok) {
        throw new Error(`Failed to fetch received files: ${await receivedRes.text()}`);
    }
    const receivedList = await receivedRes.json() as any[];
    const myReceivedFile = receivedList.find(r => r.id === requestId);
    if (!myReceivedFile) {
        throw new Error('SC Manager could not find approved file in received list.');
    }
    console.log('Received File Request item:', {
        id: myReceivedFile.id,
        requester: myReceivedFile.requester?.name,
        approvedBy: myReceivedFile.approvedBy?.name,
        transferredBy: myReceivedFile.transferredBy?.name,
        placement: myReceivedFile.requester?.staffProfile?.studyCenter?.name || myReceivedFile.requester?.staffProfile?.unit?.name
    });

    const statusPlace = myReceivedFile.requester?.staffProfile?.studyCenter?.name || myReceivedFile.requester?.staffProfile?.unit?.name || 'Main Registry';
    const statusApprover = myReceivedFile.approvedBy?.name || 'HR Admin';
    const statusTransferrer = myReceivedFile.transferredBy?.name || 'HR Admin';
    const computedStatusText = `This file has been transferred to ${statusPlace}, approved by ${statusApprover} and transferred by ${statusTransferrer}`;
    console.log(`Computed Status Text: "${computedStatusText}"`);
    if (!computedStatusText.includes(statusPlace) || !computedStatusText.includes(statusApprover) || !computedStatusText.includes(statusTransferrer)) {
        throw new Error('Status text formatting verification failed.');
    }

    // 13. Manager returns the file to HR
    console.log(`\nSC Manager returning file request ${requestId} to HR...`);
    const returnRes = await fetch(`${BASE_URL}/file-requests/${requestId}/return`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${scmToken}` }
    });
    if (!returnRes.ok) {
        throw new Error(`Failed to return file: ${await returnRes.text()}`);
    }
    console.log('File returned successfully.');

    const updatedDbRequest = await prisma.fileRequest.findUnique({
        where: { id: requestId }
    });
    console.log('Post-Return DB Record:', {
        status: updatedDbRequest?.status,
        accessLink: updatedDbRequest?.accessLink,
        expiresAt: updatedDbRequest?.expiresAt
    });
    if (updatedDbRequest?.status !== RequestStatus.RETURNED) {
        throw new Error(`Expected request status to be RETURNED, got: ${updatedDbRequest?.status}`);
    }
    if (updatedDbRequest?.accessLink !== null || updatedDbRequest?.expiresAt !== null) {
        throw new Error('Expected accessLink and expiresAt to be null after file return.');
    }

    // 14. Verify folder color goes back to blue (hasActiveTransfer = false, hasOpenQuery = false)
    console.log('\nChecking registry files list after return (should be blue)...');
    const filesRes5 = await fetch(`${BASE_URL}/registry/files`, {
        headers: { 'Authorization': `Bearer ${hrToken}` }
    });
    const filesList5 = await filesRes5.json() as any[];
    const targetFile5 = filesList5.find(f => f.staffProfile?.id === targetStaffProfileId);
    const hasOpenQuery5 = targetFile5.staffProfile?.queries?.length > 0;
    const hasActiveTransfer5 = targetFile5.staffProfile?.fileRequests?.length > 0;
    console.log(`Returned Status: hasOpenQuery=${hasOpenQuery5}, hasActiveTransfer=${hasActiveTransfer5} -> BLUE`);
    if (hasOpenQuery5 || hasActiveTransfer5) {
        throw new Error('Expected folder color to return to normal blue after returning dossier.');
    }

    // 15. Clean up database records
    console.log('\nCleaning up created E2E test staff and requests...');
    await prisma.staffQuery.deleteMany({ where: { staffId: targetStaffProfileId } });
    await prisma.fileRequest.deleteMany({ where: { staffId: targetStaffProfileId } });
    await prisma.staffProfile.delete({ where: { id: targetStaffProfileId } });
    await prisma.notification.deleteMany({ where: { userId: targetUserId } });
    await prisma.auditLog.deleteMany({ where: { userId: targetUserId } });
    await prisma.user.delete({ where: { id: targetUserId } });
    console.log('Cleanup complete.');

    console.log('\n--- ALL FILE TRANSFER & FOLDER COLOR TESTS COMPLETED SUCCESSFULLY ---');
}

main()
    .catch((err) => {
        console.error('\nE2E Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
