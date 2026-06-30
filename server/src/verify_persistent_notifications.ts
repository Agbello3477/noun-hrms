import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5055/api';

async function main() {
    console.log('--- STARTING PERSISTENT NOTIFICATION FLOW E2E TESTS ---');

    // 1. Resolve test users
    const managerUser = await prisma.user.findUnique({
        where: { email: 'studycenter.manager@noun.edu.ng' }
    });
    const hrUser = await prisma.user.findUnique({
        where: { email: 'registry@noun.edu.ng' }
    });
    const testStaffUser = await prisma.user.findUnique({
        where: { email: 'nana@noun.edu.ng' }
    });

    if (!managerUser || !hrUser || !testStaffUser) {
        throw new Error('Required test users (Lagos Manager, HR Registry, Nana Staff) not found in database.');
    }

    console.log(`Resolved Manager: ${managerUser.email} (ID: ${managerUser.id})`);
    console.log(`Resolved HR Officer: ${hrUser.email} (ID: ${hrUser.id})`);
    console.log(`Resolved Staff Member: ${testStaffUser.email} (ID: ${testStaffUser.id})`);

    // Clean up any old notifications for HR to have a clean start
    await prisma.notification.deleteMany({
        where: { userId: hrUser.id }
    });
    console.log('Cleared existing HR notifications.');

    // 2. Login Manager
    console.log('\nLogging in Manager...');
    const managerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'studycenter.manager@noun.edu.ng',
            password: 'password123',
            loginType: 'UNIT'
        })
    });
    if (!managerLoginRes.ok) {
        throw new Error(`Manager login failed: ${await managerLoginRes.text()}`);
    }
    const managerToken = (await managerLoginRes.json() as { token: string }).token;
    console.log('Manager logged in successfully.');

    // 3. Login HR Admin
    console.log('\nLogging in HR Admin...');
    const hrLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'registry@noun.edu.ng',
            password: 'password123',
            loginType: 'REGISTRY'
        })
    });
    if (!hrLoginRes.ok) {
        throw new Error(`HR Admin login failed: ${await hrLoginRes.text()}`);
    }
    const hrToken = (await hrLoginRes.json() as { token: string }).token;
    console.log('HR Admin logged in successfully.');

    // 4. Manager creates a File Transfer Request
    console.log('\nManager creating a file transfer request...');
    const staffProfile = await prisma.staffProfile.findUnique({
        where: { userId: testStaffUser.id }
    });
    if (!staffProfile) {
        throw new Error('Staff profile not found for test user.');
    }

    const fileRequestRes = await fetch(`${BASE_URL}/file-requests/request`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${managerToken}`
        },
        body: JSON.stringify({
            staffId: staffProfile.id,
            reason: 'Reason: Promo review | Document Type: Personal File | Urgency: HIGH'
        })
    });
    if (!fileRequestRes.ok) {
        throw new Error(`Failed to create file request: ${await fileRequestRes.text()}`);
    }
    const fileRequest = await fileRequestRes.json() as { id: string };
    console.log(`File request created with ID: ${fileRequest.id}`);

    // 5. Fetch HR Admin notifications (should see "New File Request")
    console.log('\nFetching HR Admin notifications (expecting New File Request)...');
    const hrNotifRes1 = await fetch(`${BASE_URL}/notifications`, {
        headers: { 'Authorization': `Bearer ${hrToken}` }
    });
    if (!hrNotifRes1.ok) {
        throw new Error(`Failed to fetch HR notifications: ${await hrNotifRes1.text()}`);
    }
    const hrNotifData1 = await hrNotifRes1.json() as { notifications: any[], unreadCount: number };
    console.log(`HR Admin notifications count: ${hrNotifData1.notifications.length}, unreadCount: ${hrNotifData1.unreadCount}`);
    
    const requestNotification = hrNotifData1.notifications.find(n => n.title === 'New File Request');
    if (!requestNotification) {
        throw new Error('Expected "New File Request" notification not found.');
    }
    console.log(`Found Notification: "${requestNotification.title}" - "${requestNotification.message}" (isRead: ${requestNotification.isRead})`);
    if (requestNotification.isRead) {
        throw new Error('Notification should start as unread.');
    }

    // 6. HR Admin approves the request
    console.log(`\nHR Admin approving request ${fileRequest.id}...`);
    const approveRes = await fetch(`${BASE_URL}/file-requests/${fileRequest.id}/approve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${hrToken}` }
    });
    if (!approveRes.ok) {
        throw new Error(`Failed to approve request: ${await approveRes.text()}`);
    }
    console.log('Request approved successfully.');

    // 7. HR Admin acknowledges all notifications
    console.log('\nHR Admin acknowledging all notifications...');
    const ackRes = await fetch(`${BASE_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${hrToken}` }
    });
    if (!ackRes.ok) {
        throw new Error(`Failed to mark all read: ${await ackRes.text()}`);
    }
    
    // Fetch notifications again to confirm unreadCount is 0
    const hrNotifRes2 = await fetch(`${BASE_URL}/notifications`, {
        headers: { 'Authorization': `Bearer ${hrToken}` }
    });
    const hrNotifData2 = await hrNotifRes2.json() as { unreadCount: number };
    console.log(`HR Admin unreadCount after Acknowledge All: ${hrNotifData2.unreadCount}`);
    if (hrNotifData2.unreadCount !== 0) {
        throw new Error(`Expected unreadCount to be 0, got ${hrNotifData2.unreadCount}`);
    }
    console.log('HR Notifications successfully acknowledged.');

    // 8. Manager returns the file (should trigger "File Returned to HR" notification)
    console.log('\nManager returning the file back to HR...');
    const returnRes = await fetch(`${BASE_URL}/file-requests/${fileRequest.id}/return`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${managerToken}`
        }
    });
    if (!returnRes.ok) {
        throw new Error(`Failed to return file: ${await returnRes.text()}`);
    }
    console.log('File returned successfully.');

    // 9. Fetch HR Admin notifications again (expecting "File Returned to HR")
    console.log('\nFetching HR Admin notifications (expecting File Returned to HR)...');
    const hrNotifRes3 = await fetch(`${BASE_URL}/notifications`, {
        headers: { 'Authorization': `Bearer ${hrToken}` }
    });
    const hrNotifData3 = await hrNotifRes3.json() as { notifications: any[], unreadCount: number };
    console.log(`HR Admin notifications count: ${hrNotifData3.notifications.length}, unreadCount: ${hrNotifData3.unreadCount}`);
    
    const returnNotification = hrNotifData3.notifications.find(n => n.title === 'File Returned to HR');
    if (!returnNotification) {
        throw new Error('Expected "File Returned to HR" notification not found.');
    }
    console.log(`Found Notification: "${returnNotification.title}" - "${returnNotification.message}" (isRead: ${returnNotification.isRead})`);
    if (returnNotification.isRead) {
        throw new Error('Return notification should start as unread.');
    }
    if (hrNotifData3.unreadCount !== 1) {
        throw new Error(`Expected unreadCount to be 1, got ${hrNotifData3.unreadCount}`);
    }

    // 10. Clean up test data
    console.log('\nCleaning up E2E notifications test data...');
    await prisma.fileRequest.delete({
        where: { id: fileRequest.id }
    });
    await prisma.notification.deleteMany({
        where: { userId: hrUser.id }
    });
    console.log('Cleanup finished successfully.');

    console.log('\n--- ALL PERSISTENT NOTIFICATION FLOW E2E TESTS PASSED ---');
}

main()
    .catch((err) => {
        console.error('\nE2E Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
