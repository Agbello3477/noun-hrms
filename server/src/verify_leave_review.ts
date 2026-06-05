import { PrismaClient, LeaveStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5055/api';

async function main() {
    console.log('--- STARTING LEAVE REVIEW E2E VERIFICATION ---');

    const staffEmail = 'nana@noun.edu.ng';
    const managerEmail = 'studycenter.manager@noun.edu.ng';

    // 1. Reset passwords in the database to a known state to guarantee we can log in
    console.log('Resetting passwords for test accounts in database...');
    const hashedPwd = await bcrypt.hash('password123', 10);
    await prisma.user.update({
        where: { email: staffEmail },
        data: { password: hashedPwd }
    });
    await prisma.user.update({
        where: { email: managerEmail },
        data: { password: hashedPwd }
    });
    console.log('Passwords updated.');

    // 2. Clean up any existing leave requests for the test staff to avoid test pollution
    const staffUser = await prisma.user.findUnique({
        where: { email: staffEmail },
        include: { staffProfile: true }
    });
    if (!staffUser || !staffUser.staffProfile) {
        throw new Error(`Staff user ${staffEmail} not found!`);
    }

    console.log('Cleaning up existing leave requests for staff...');
    await prisma.leaveRequest.deleteMany({
        where: { staffId: staffUser.staffProfile.id }
    });
    console.log('Cleaned up old leave requests.');

    // 3. Log in as Lagos Study Center Staff (Nana)
    console.log('\nLogging in staff (Nana)...');
    const staffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: staffEmail,
            password: 'password123',
            loginType: 'NV'
        })
    });
    if (!staffLoginRes.ok) {
        throw new Error(`Staff login failed: ${await staffLoginRes.text()}`);
    }
    const staffToken = (await staffLoginRes.json() as { token: string }).token;
    console.log('Staff logged in successfully.');

    // 4. Staff applies for a 10-day leave (e.g., starting today)
    console.log('\nStaff applying for 10-day leave...');
    const startDate = new Date();
    startDate.setDate(startDate.getDate()); // start today
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 9); // 10 days duration (including today)

    const applyRes = await fetch(`${BASE_URL}/leaves/apply`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${staffToken}`
        },
        body: JSON.stringify({
            type: 'ANNUAL',
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            reason: 'Annual family vacation'
        })
    });
    if (!applyRes.ok) {
        throw new Error(`Failed to apply for leave: ${await applyRes.text()}`);
    }
    const applyData = await applyRes.json() as any;
    console.log('Leave applied successfully. ID:', applyData.leave.id);

    // 5. Log in as Lagos Study Center Manager
    console.log('\nLogging in Lagos Study Center Manager...');
    const managerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: managerEmail,
            password: 'password123',
            loginType: 'NV'
        })
    });
    if (!managerLoginRes.ok) {
        throw new Error(`Manager login failed: ${await managerLoginRes.text()}`);
    }
    const managerToken = (await managerLoginRes.json() as { token: string }).token;
    console.log('Manager logged in successfully.');

    // 6. Manager views pending leave applications
    console.log('\nManager fetching pending leaves...');
    const pendingRes = await fetch(`${BASE_URL}/leaves/pending`, {
        headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    if (!pendingRes.ok) {
        throw new Error(`Failed to fetch pending leaves: ${await pendingRes.text()}`);
    }
    const pendingLeaves = await pendingRes.json() as any[];
    console.log(`Found ${pendingLeaves.length} pending leave requests.`);
    const matchingRequest = pendingLeaves.find(l => l.id === applyData.leave.id);
    if (!matchingRequest) {
        throw new Error('Manager could not view the newly created leave application!');
    }
    console.log('Verification Passed: Manager can view the leave request.');

    // 7. Manager approves the leave but reduces it to 5 days
    console.log('\nManager approving request with reduced days (5 days)...');
    const approveRes = await fetch(`${BASE_URL}/leaves/status`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${managerToken}`
        },
        body: JSON.stringify({
            leaveId: applyData.leave.id,
            status: 'APPROVED',
            approvedDays: 5
        })
    });
    if (!approveRes.ok) {
        throw new Error(`Failed to approve leave with reduced days: ${await approveRes.text()}`);
    }
    console.log('Approval response successful.');

    // Verify DB update
    const approvedLeaveInDb = await prisma.leaveRequest.findUnique({
        where: { id: applyData.leave.id }
    });
    if (!approvedLeaveInDb) {
        throw new Error('Leave request not found in database after approval.');
    }
    console.log('Approved Leave in DB status:', approvedLeaveInDb.status);
    console.log('Approved Leave in DB durationDays:', approvedLeaveInDb.durationDays);
    console.log('Approved Leave in DB original start:', approvedLeaveInDb.startDate);
    console.log('Approved Leave in DB updated end:', approvedLeaveInDb.endDate);

    if (approvedLeaveInDb.status !== LeaveStatus.APPROVED) {
        throw new Error(`Expected status APPROVED, got ${approvedLeaveInDb.status}`);
    }
    if (approvedLeaveInDb.durationDays !== 5) {
        throw new Error(`Expected durationDays to be 5, got ${approvedLeaveInDb.durationDays}`);
    }

    const expectedEnd = new Date(approvedLeaveInDb.startDate);
    expectedEnd.setDate(expectedEnd.getDate() + 4); // 5 days duration: start date is day 1, so add 4 days
    if (new Date(approvedLeaveInDb.endDate).toDateString() !== expectedEnd.toDateString()) {
        throw new Error(`Expected end date ${expectedEnd.toDateString()}, got ${new Date(approvedLeaveInDb.endDate).toDateString()}`);
    }
    console.log('Verification Passed: Duration updated to 5 days and end date recalculated correctly.');

    // Fetch unit staff list as manager to verify she shows as "On Leave"
    console.log('\nFetching unit staff directory as manager to verify status...');
    const staffListRes = await fetch(`${BASE_URL}/staff/unit`, {
        headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    if (!staffListRes.ok) {
        throw new Error(`Failed to fetch unit staff: ${await staffListRes.text()}`);
    }
    const staffList = await staffListRes.json() as any[];
    const nanaStaff = staffList.find(s => s.email === staffEmail);
    if (!nanaStaff) {
        throw new Error('Nana not found in unit staff list!');
    }
    console.log('Nana Staff Record leaves in staff directory:', JSON.stringify(nanaStaff.staffProfile?.leaves, null, 2));

    const todayTest = new Date();
    const hasActiveLeave = nanaStaff.staffProfile?.leaves?.some((l: any) => {
        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return todayTest >= start && todayTest <= end;
    });

    if (!hasActiveLeave) {
        throw new Error('Nana should be marked as currently ON LEAVE based on approved leaves list, but active leave check failed!');
    }
    console.log('Verification Passed: Nana shows as ON LEAVE in the manager staff directory API.');

    // 8. Staff applies for a second leave request to test rejection
    console.log('\nStaff applying for a second leave request...');
    const applyRes2 = await fetch(`${BASE_URL}/leaves/apply`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${staffToken}`
        },
        body: JSON.stringify({
            type: 'SICK',
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            reason: 'Medical checkup'
        })
    });
    if (!applyRes2.ok) {
        throw new Error(`Failed to apply for second leave: ${await applyRes2.text()}`);
    }
    const applyData2 = await applyRes2.json() as any;
    console.log('Second leave applied successfully. ID:', applyData2.leave.id);

    // 9. Manager rejects the second leave request with a rejection reason
    const rejectionReason = 'Inadequate medical documentation provided.';
    console.log('\nManager rejecting request with reason...');
    const rejectRes = await fetch(`${BASE_URL}/leaves/status`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${managerToken}`
        },
        body: JSON.stringify({
            leaveId: applyData2.leave.id,
            status: 'REJECTED',
            comment: rejectionReason
        })
    });
    if (!rejectRes.ok) {
        throw new Error(`Failed to reject leave: ${await rejectRes.text()}`);
    }
    console.log('Rejection response successful.');

    // Verify DB update
    const rejectedLeaveInDb = await prisma.leaveRequest.findUnique({
        where: { id: applyData2.leave.id }
    });
    if (!rejectedLeaveInDb) {
        throw new Error('Second leave request not found in database after rejection.');
    }
    console.log('Rejected Leave in DB status:', rejectedLeaveInDb.status);
    console.log('Rejected Leave in DB rejectionReason:', rejectedLeaveInDb.rejectionReason);

    if (rejectedLeaveInDb.status !== LeaveStatus.REJECTED) {
        throw new Error(`Expected status REJECTED, got ${rejectedLeaveInDb.status}`);
    }
    if (rejectedLeaveInDb.rejectionReason !== rejectionReason) {
        throw new Error(`Expected rejectionReason "${rejectionReason}", got "${rejectedLeaveInDb.rejectionReason}"`);
    }
    console.log('Verification Passed: Request rejected successfully and reason stored in database.');

    // Verify notifications generated in DB
    console.log('\nVerifying notifications generated in database for staff...');
    const userNotifications = await prisma.notification.findMany({
        where: { userId: staffUser.id },
        orderBy: { createdAt: 'desc' }
    });
    console.log(`Found ${userNotifications.length} notifications:`);
    for (const n of userNotifications) {
        console.log(`- Title: "${n.title}", Message: "${n.message}", Link: "${n.link || ''}"`);
    }

    if (userNotifications.length < 2) {
        throw new Error(`Expected at least 2 notifications, found ${userNotifications.length}`);
    }

    const hasApprovalNotif = userNotifications.some(n => n.title.includes('APPROVED'));
    const hasRejectionNotif = userNotifications.some(n => n.title.includes('REJECTED'));
    if (!hasApprovalNotif || !hasRejectionNotif) {
        throw new Error('Missing leave approval or rejection notification!');
    }
    console.log('Verification Passed: Leave approval and rejection notifications were successfully generated.');

    // Clean up notifications
    await prisma.notification.deleteMany({
        where: { userId: staffUser.id }
    });

    // Clean up
    console.log('\nCleaning up created test leaves...');
    await prisma.leaveRequest.deleteMany({
        where: { staffId: staffUser.staffProfile.id }
    });
    console.log('Cleanup complete.');

    console.log('\n--- ALL LEAVE REVIEW E2E VERIFICATIONS PASSED SUCCESSFULLY ---');
}

main()
    .catch((err) => {
        console.error('\nVerification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
