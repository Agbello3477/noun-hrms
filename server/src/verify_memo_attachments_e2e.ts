import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5055/api';

async function main() {
    console.log('--- STARTING MEMO ATTACHMENT E2E TESTS ---');

    const testMemoTitle = 'E2E Test Memo with Attachment';

    // 1. Cleanup old test memos
    console.log('\nCleaning up old test memos...');
    await prisma.memoResponse.deleteMany({
        where: {
            memo: { title: testMemoTitle }
        }
    });
    await prisma.memo.deleteMany({
        where: { title: testMemoTitle }
    });
    console.log('Cleaned up old test data.');

    // 2. Login Admin to get authorization token
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
    const adminToken = (await adminLoginRes.json() as { token: string }).token;
    console.log('Admin logged in successfully.');

    // 3. Create Memo with Attachment using FormData
    console.log('\nCreating memo with file attachment...');
    const formData = new FormData();
    formData.append('title', testMemoTitle);
    formData.append('content', 'This is a test memo containing a PDF attachment.');
    formData.append('allowResponses', 'true');
    
    // Create a mock attachment file
    const fileBlob = new Blob(['Mock PDF file contents for E2E testing'], { type: 'application/pdf' });
    formData.append('file', fileBlob, 'test_attachment.pdf');

    const createRes = await fetch(`${BASE_URL}/memos`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${adminToken}`
            // Note: Do not set Content-Type header manually when sending FormData,
            // fetch will automatically set it to multipart/form-data with the correct boundary!
        },
        body: formData
    });

    if (!createRes.ok) {
        throw new Error(`Failed to create memo with attachment: ${await createRes.text()}`);
    }
    const createdMemo = await createRes.json() as any;
    console.log('Memo created successfully:', {
        id: createdMemo.id,
        title: createdMemo.title,
        attachmentUrl: createdMemo.attachmentUrl,
        attachmentName: createdMemo.attachmentName
    });

    if (!createdMemo.attachmentUrl || createdMemo.attachmentName !== 'test_attachment.pdf') {
        throw new Error('Attachment URL or name mismatch in creation response');
    }

    // 4. Verify in DB
    console.log('\nVerifying record in database...');
    const dbMemo = await prisma.memo.findUnique({
        where: { id: createdMemo.id }
    });
    if (!dbMemo) {
        throw new Error('Memo not found in database.');
    }
    console.log('Database record:', {
        id: dbMemo.id,
        attachmentUrl: dbMemo.attachmentUrl,
        attachmentName: dbMemo.attachmentName
    });
    if (!dbMemo.attachmentUrl || dbMemo.attachmentName !== 'test_attachment.pdf') {
        throw new Error('Database record does not have the expected attachment values');
    }

    // 5. Verify detail retrieval endpoint
    console.log('\nRetrieving memo details via endpoint...');
    const detailsRes = await fetch(`${BASE_URL}/memos/${createdMemo.id}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (!detailsRes.ok) {
        throw new Error(`Failed to fetch details: ${await detailsRes.text()}`);
    }
    const memoDetails = await detailsRes.json() as any;
    console.log('Memo details response:', {
        id: memoDetails.id,
        attachmentUrl: memoDetails.attachmentUrl,
        attachmentName: memoDetails.attachmentName
    });
    if (!memoDetails.attachmentUrl || memoDetails.attachmentName !== 'test_attachment.pdf') {
        throw new Error('Endpoint details response does not have the expected attachment values');
    }

    // 6. Clean up
    console.log('\nCleaning up E2E test data...');
    await prisma.memo.delete({
        where: { id: createdMemo.id }
    });
    console.log('Cleanup finished.');

    console.log('\n--- ALL ATTACHMENT E2E TESTS COMPLETED SUCCESSFULLY ---');
}

main()
    .catch((err) => {
        console.error('Test script failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
