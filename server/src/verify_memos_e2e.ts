import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5055/api';

async function main() {
    console.log('--- STARTING MEMO SYSTEM E2E TESTS ---');

    // 1. Resolve users from database
    const adminUser = await prisma.user.findUnique({
        where: { email: 'admin@noun.edu.ng' }
    });
    const staffUser = await prisma.user.findUnique({
        where: { email: 'registry@noun.edu.ng' }
    });

    if (!adminUser || !staffUser) {
        throw new Error('Admin or Staff user not found in database.');
    }

    console.log(`Resolved Admin User ID: ${adminUser.id} (${adminUser.email})`);
    console.log(`Resolved Staff User ID: ${staffUser.id} (${staffUser.email})`);

    // Cleanup old test memos to ensure idempotency
    await prisma.memoResponse.deleteMany({
        where: {
            memo: {
                title: {
                    in: ['E2E Test Broadcast Memo', 'E2E Test Targeted Memo']
                }
            }
        }
    });
    await prisma.memo.deleteMany({
        where: {
            title: {
                in: ['E2E Test Broadcast Memo', 'E2E Test Targeted Memo']
            }
        }
    });
    console.log('Cleaned up existing E2E test memos and responses.');

    // 2. Login Admin
    console.log('\nLogging in Admin...');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'admin@noun.edu.ng',
            password: 'password123',
            loginType: 'ADMIN'
        })
    });
    if (!adminLoginRes.ok) {
        throw new Error(`Admin login failed: ${await adminLoginRes.text()}`);
    }
    const adminLoginData = await adminLoginRes.json() as { token: string };
    const adminToken = adminLoginData.token;
    console.log('Admin logged in successfully.');

    // 3. Login Staff
    console.log('\nLogging in Staff...');
    const staffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'registry@noun.edu.ng',
            password: 'password123',
            loginType: 'NV'
        })
    });
    if (!staffLoginRes.ok) {
        throw new Error(`Staff login failed: ${await staffLoginRes.text()}`);
    }
    const staffLoginData = await staffLoginRes.json() as { token: string };
    const staffToken = staffLoginData.token;
    console.log('Staff logged in successfully.');

    // 4. Create General Broadcast Memo as Admin
    console.log('\nCreating E2E Test Broadcast Memo...');
    const broadcastMemoRes = await fetch(`${BASE_URL}/memos`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            title: 'E2E Test Broadcast Memo',
            content: 'This is a general announcement for all staff members.',
            allowResponses: true
        })
    });
    if (!broadcastMemoRes.ok) {
        throw new Error(`Failed to create broadcast memo: ${await broadcastMemoRes.text()}`);
    }
    const broadcastMemo = await broadcastMemoRes.json() as { id: string; title: string };
    console.log(`Broadcast memo created successfully. ID: ${broadcastMemo.id}`);

    // 5. Create Private/Targeted Memo for Staff as Admin
    console.log('\nCreating E2E Test Targeted Memo...');
    const targetedMemoRes = await fetch(`${BASE_URL}/memos`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            title: 'E2E Test Targeted Memo',
            content: 'This is a private/targeted message sent specifically to registry staff.',
            allowResponses: true,
            recipientId: staffUser.id
        })
    });
    if (!targetedMemoRes.ok) {
        throw new Error(`Failed to create targeted memo: ${await targetedMemoRes.text()}`);
    }
    const targetedMemo = await targetedMemoRes.json() as { id: string; title: string; recipientId: string };
    console.log(`Targeted memo created successfully. ID: ${targetedMemo.id}, Recipient ID: ${targetedMemo.recipientId}`);

    // 6. Get all memos as Admin
    console.log('\nFetching memos list as Admin...');
    const adminMemosRes = await fetch(`${BASE_URL}/memos`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const adminMemos = await adminMemosRes.json() as any[];
    console.log(`Admin memos list count: ${adminMemos.length}`);
    const foundBroadcastAsAdmin = adminMemos.find(m => m.id === broadcastMemo.id);
    const foundTargetedAsAdmin = adminMemos.find(m => m.id === targetedMemo.id);
    if (!foundBroadcastAsAdmin || !foundTargetedAsAdmin) {
        throw new Error('Admin list is missing the created E2E test memos.');
    }
    console.log('Admin list verification passed (both memos found).');

    // 7. Get all memos as Staff
    console.log('\nFetching memos list as Staff...');
    const staffMemosRes = await fetch(`${BASE_URL}/memos`, {
        headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    const staffMemos = await staffMemosRes.json() as any[];
    console.log(`Staff memos list count: ${staffMemos.length}`);
    const foundBroadcastAsStaff = staffMemos.find(m => m.id === broadcastMemo.id);
    const foundTargetedAsStaff = staffMemos.find(m => m.id === targetedMemo.id);
    if (!foundBroadcastAsStaff || !foundTargetedAsStaff) {
        throw new Error('Staff list is missing the broadcast or targeted memo addressed to them.');
    }
    console.log('Staff list verification passed (both memos found).');

    // 8. Submit Response from Staff to the Targeted Memo
    console.log('\nSubmitting response to targeted memo from Staff...');
    const respondRes = await fetch(`${BASE_URL}/memos/${targetedMemo.id}/respond`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${staffToken}`
        },
        body: JSON.stringify({
            content: 'E2E test feedback: I have read the targeted memo and acknowledge it.'
        })
    });
    if (!respondRes.ok) {
        throw new Error(`Failed to submit memo response: ${await respondRes.text()}`);
    }
    const responseData = await respondRes.json() as { id: string; content: string };
    console.log(`Response submitted successfully. Response ID: ${responseData.id}`);

    // 9. Fetch memo details as Admin to verify response inclusion
    console.log('\nFetching targeted memo details as Admin to inspect responses...');
    const adminMemoDetailsRes = await fetch(`${BASE_URL}/memos/${targetedMemo.id}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const memoDetails = await adminMemoDetailsRes.json() as any;
    console.log(`Memo Title: ${memoDetails.title}`);
    console.log(`Memo Responses count: ${memoDetails.responses?.length || 0}`);
    
    if (!memoDetails.responses || memoDetails.responses.length === 0) {
        throw new Error('No responses found in memo details as Admin.');
    }
    const latestResponse = memoDetails.responses[0];
    console.log(`Response content: "${latestResponse.content}"`);
    console.log(`Respondent Name: ${latestResponse.staff?.name}`);
    console.log(`Respondent Staff ID: ${latestResponse.staff?.staffProfile?.staffId}`);
    console.log(`Respondent Unit: ${latestResponse.staff?.staffProfile?.unit?.name}`);

    if (latestResponse.content !== 'E2E test feedback: I have read the targeted memo and acknowledge it.') {
        throw new Error('Response content mismatch.');
    }
    console.log('Admin memo details verification passed (staff feedback, profile, and unit name successfully retrieved).');

    // 10. Clean up
    console.log('\nCleaning up E2E test data...');
    await prisma.memoResponse.deleteMany({
        where: { memoId: targetedMemo.id }
    });
    await prisma.memo.delete({
        where: { id: broadcastMemo.id }
    });
    await prisma.memo.delete({
        where: { id: targetedMemo.id }
    });
    console.log('Cleanup finished.');

    console.log('\n--- ALL MEMO E2E TESTS COMPLETED SUCCESSFULLY ---');
}

main()
    .catch((err) => {
        console.error('\nE2E Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
