import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5055/api';

async function main() {
    console.log('--- STARTING UNIT MEMO SCORING & BOUNDARY E2E TESTS ---');

    // 1. Resolve users from database
    const managerUser = await prisma.user.findUnique({
        where: { email: 'studycenter.manager@noun.edu.ng' }
    });
    const unitStaffUser = await prisma.user.findUnique({
        where: { email: 'nana@noun.edu.ng' }
    });
    const outsiderStaffUser = await prisma.user.findUnique({
        where: { email: 'lecturer.cs@noun.edu.ng' }
    });

    if (!managerUser || !unitStaffUser || !outsiderStaffUser) {
        throw new Error('Required test users (Lagos Manager, Lagos Staff, CS Staff) not found in database.');
    }

    console.log(`Resolved Unit Manager: ${managerUser.email} (ID: ${managerUser.id})`);
    console.log(`Resolved Unit Staff: ${unitStaffUser.email} (ID: ${unitStaffUser.id})`);
    console.log(`Resolved Outsider Staff: ${outsiderStaffUser.email} (ID: ${outsiderStaffUser.id})`);

    // Cleanup old test memos to ensure idempotency
    await prisma.memoResponse.deleteMany({
        where: {
            memo: {
                title: {
                    in: ['E2E Unit Broadcast Memo', 'E2E Unit Targeted Memo']
                }
            }
        }
    });
    await prisma.memo.deleteMany({
        where: {
            title: {
                in: ['E2E Unit Broadcast Memo', 'E2E Unit Targeted Memo']
            }
        }
    });
    console.log('Cleaned up existing E2E test unit memos and responses.');

    // 2. Login Unit Manager
    console.log('\nLogging in Unit Manager...');
    const managerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'studycenter.manager@noun.edu.ng',
            password: 'password123',
            loginType: 'UNIT' // Any non-registry login type works
        })
    });
    if (!managerLoginRes.ok) {
        throw new Error(`Manager login failed: ${await managerLoginRes.text()}`);
    }
    const managerLoginData = await managerLoginRes.json() as { token: string };
    const managerToken = managerLoginData.token;
    console.log('Manager logged in successfully.');

    // 3. Login Unit Staff
    console.log('\nLogging in Unit Staff...');
    const staffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'nana@noun.edu.ng',
            password: 'password123',
            loginType: 'STAFF'
        })
    });
    if (!staffLoginRes.ok) {
        throw new Error(`Unit staff login failed: ${await staffLoginRes.text()}`);
    }
    const staffLoginData = await staffLoginRes.json() as { token: string };
    const staffToken = staffLoginData.token;
    console.log('Unit Staff logged in successfully.');

    // 4. Create Scoped Targeted Memo to Unit Staff (Lagos Study Center)
    console.log('\nCreating E2E Scoped Targeted Memo to Unit Staff...');
    const targetedMemoRes = await fetch(`${BASE_URL}/memos`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${managerToken}`
        },
        body: JSON.stringify({
            title: 'E2E Unit Targeted Memo',
            content: 'This is a private memo sent by the Lagos Manager to a Lagos staff member.',
            allowResponses: true,
            recipientId: unitStaffUser.id
        })
    });
    if (!targetedMemoRes.ok) {
        throw new Error(`Failed to create unit targeted memo: ${await targetedMemoRes.text()}`);
    }
    const targetedMemo = await targetedMemoRes.json() as { id: string; title: string };
    console.log(`Unit targeted memo created successfully. ID: ${targetedMemo.id}`);

    // 5. Attempt to Create Scoped Targeted Memo to Outsider Staff (Should fail 403)
    console.log('\nAttempting to send memo to outsider staff member (should fail)...');
    const invalidMemoRes = await fetch(`${BASE_URL}/memos`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${managerToken}`
        },
        body: JSON.stringify({
            title: 'E2E Unit Targeted Memo',
            content: 'This memo goes outside my center, it should be blocked.',
            allowResponses: true,
            recipientId: outsiderStaffUser.id
        })
    });
    console.log(`Outsider targeted memo status: ${invalidMemoRes.status}`);
    if (invalidMemoRes.status !== 403) {
        throw new Error(`Expected 403 Forbidden when emailing outsider, got ${invalidMemoRes.status}`);
    }
    console.log('Outsider targeting successfully blocked (returned 403 Forbidden).');

    // 6. Create Scoped Broadcast Memo (should auto-target unit/center staff nana)
    console.log('\nCreating E2E Scoped Broadcast Memo...');
    const broadcastMemoRes = await fetch(`${BASE_URL}/memos`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${managerToken}`
        },
        body: JSON.stringify({
            title: 'E2E Unit Broadcast Memo',
            content: 'This is a broadcast announcement for all staff under Lagos Study Center.',
            allowResponses: true
        })
    });
    if (!broadcastMemoRes.ok) {
        throw new Error(`Failed to create unit broadcast memo: ${await broadcastMemoRes.text()}`);
    }
    const broadcastMemo = await broadcastMemoRes.json() as { id: string; title: string };
    console.log(`Unit broadcast memo created successfully. ID: ${broadcastMemo.id}`);

    // 7. Verify Unit Staff can see both memos
    console.log('\nVerifying unit staff visibility...');
    const staffMemosRes = await fetch(`${BASE_URL}/memos`, {
        headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    const staffMemos = await staffMemosRes.json() as any[];
    console.log(`Unit staff total visible memos: ${staffMemos.length}`);
    console.log('Memos in Staff list:', staffMemos.map(m => ({ id: m.id, title: m.title, recipientId: m.recipientId, senderId: m.senderId })));
    console.log('Targeted Memo ID:', targetedMemo.id);
    console.log('Broadcast Memo ID:', broadcastMemo.id);

    const foundTargeted = staffMemos.find(m => m.id === targetedMemo.id);
    const foundBroadcast = staffMemos.find(m => m.title === 'E2E Unit Broadcast Memo');
    if (!foundTargeted || !foundBroadcast) {
        throw new Error(`Unit staff member cannot see the scoped targeted or broadcast memo. FoundTargeted: ${!!foundTargeted}, FoundBroadcast: ${!!foundBroadcast}`);
    }
    console.log('Unit staff visibility check passed.');

    // 8. Submit Response from Unit Staff
    console.log('\nSubmitting staff response to targeted memo...');
    const respondRes = await fetch(`${BASE_URL}/memos/${targetedMemo.id}/respond`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${staffToken}`
        },
        body: JSON.stringify({
            content: 'Acknowledged by Nana.'
        })
    });
    if (!respondRes.ok) {
        throw new Error(`Failed to submit response: ${await respondRes.text()}`);
    }
    console.log('Staff response submitted successfully.');

    // 9. Verify Manager can view the memo and responses
    console.log('\nVerifying Manager can see the sent memo and response details...');
    const managerMemoDetailsRes = await fetch(`${BASE_URL}/memos/${targetedMemo.id}`, {
        headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    const details = await managerMemoDetailsRes.json() as any;
    console.log(`Manager details check responses count: ${details.responses?.length || 0}`);
    if (!details.responses || details.responses.length === 0) {
        throw new Error('Manager details view is missing responses.');
    }
    console.log(`Response content: "${details.responses[0].content}" from ${details.responses[0].staff?.name}`);
    console.log('Manager details response visibility check passed.');

    // 10. Cleanup
    console.log('\nCleaning up E2E test data...');
    await prisma.memoResponse.deleteMany({
        where: { memoId: targetedMemo.id }
    });
    await prisma.memo.deleteMany({
        where: {
            title: {
                in: ['E2E Unit Broadcast Memo', 'E2E Unit Targeted Memo']
            }
        }
    });
    console.log('Cleanup finished successfully.');

    console.log('\n--- ALL UNIT MEMO SCORING & BOUNDARY E2E TESTS PASSED ---');
}

main()
    .catch((err) => {
        console.error('\nE2E Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
