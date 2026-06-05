import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5055/api';

async function main() {
    console.log('--- STARTING DUPLICATE STAFF FILE PREVENTION E2E TESTS ---');

    const testEmail = 'test.duplicate@noun.edu.ng';
    const testPhone = '08000000001';
    const testSurname = 'Duplicate';
    const testOtherNames = 'Test';

    // 1. Cleanup old test staff
    console.log('\nCleaning up old test user/profile if any exists...');
    const existingTestUser = await prisma.user.findUnique({
        where: { email: testEmail },
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
        console.log('Cleaned up old test user.');
    }

    // Also clean up by phone if any other profile has it
    const existingPhoneProfile = await prisma.staffProfile.findFirst({
        where: { phone: testPhone },
        include: { user: true }
    });
    if (existingPhoneProfile) {
        await prisma.staffProfile.delete({ where: { id: existingPhoneProfile.id } });
        await prisma.user.delete({ where: { id: existingPhoneProfile.userId } });
        console.log('Cleaned up old test user by phone.');
    }

    // 2. Log in as HR Admin to get authorization token
    console.log('\nLogging in as HR Admin (Registry)...');
    const hrLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'registry@noun.edu.ng',
            password: 'password123',
            loginType: 'HR'
        })
    });
    if (!hrLoginRes.ok) {
        throw new Error(`HR login failed: ${await hrLoginRes.text()}`);
    }
    const hrToken = (await hrLoginRes.json() as { token: string }).token;
    console.log('HR Admin logged in successfully.');

    // 3. Create initial staff file
    console.log('\nCreating initial staff file...');
    const createRes = await fetch(`${BASE_URL}/registry/files/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hrToken}`
        },
        body: JSON.stringify({
            surname: testSurname,
            otherNames: testOtherNames,
            email: testEmail,
            role: 'STAFF',
            level: 'CONTISS 7',
            step: '1',
            cadre: 'ADMINISTRATIVE',
            phone: testPhone,
            stateOfOrigin: 'Lagos',
            lga: 'Ikeja',
            address: '123 Test Road'
        })
    });

    if (!createRes.ok) {
        throw new Error(`Failed to create initial staff file: ${await createRes.text()}`);
    }
    const createData = await createRes.json() as any;
    const initialStaffId = createData.staffId;
    console.log(`Initial staff file created successfully. Staff ID: ${initialStaffId}`);

    // 4. Attempt to create duplicate by email
    console.log('\nAttempting to create staff file with duplicate email...');
    const dupEmailRes = await fetch(`${BASE_URL}/registry/files/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hrToken}`
        },
        body: JSON.stringify({
            surname: 'DifferentName',
            otherNames: 'Staff',
            email: testEmail,
            role: 'STAFF',
            level: 'CONTISS 7',
            step: '1',
            cadre: 'ADMINISTRATIVE',
            phone: '08099999999',
            stateOfOrigin: 'Lagos',
            lga: 'Ikeja',
            address: '123 Test Road'
        })
    });

    if (dupEmailRes.ok) {
        throw new Error('Expected duplicate email check to fail, but it succeeded.');
    }
    const dupEmailErr = await dupEmailRes.json() as any;
    console.log(`Blocked duplicate email check as expected. Error message: ${dupEmailErr.message}`);
    if (!dupEmailErr.message.includes('email already exists')) {
        throw new Error(`Unexpected error message: ${dupEmailErr.message}`);
    }

    // 5. Attempt to create duplicate by phone
    console.log('\nAttempting to create staff file with duplicate phone number...');
    const dupPhoneRes = await fetch(`${BASE_URL}/registry/files/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hrToken}`
        },
        body: JSON.stringify({
            surname: 'DifferentName',
            otherNames: 'Staff',
            email: 'diff.email@noun.edu.ng',
            role: 'STAFF',
            level: 'CONTISS 7',
            step: '1',
            cadre: 'ADMINISTRATIVE',
            phone: testPhone,
            stateOfOrigin: 'Lagos',
            lga: 'Ikeja',
            address: '123 Test Road'
        })
    });

    if (dupPhoneRes.ok) {
        throw new Error('Expected duplicate phone check to fail, but it succeeded.');
    }
    const dupPhoneErr = await dupPhoneRes.json() as any;
    console.log(`Blocked duplicate phone check as expected. Error message: ${dupPhoneErr.message}`);
    if (!dupPhoneErr.message.includes('phone number already exists')) {
        throw new Error(`Unexpected error message: ${dupPhoneErr.message}`);
    }

    // 6. Attempt to create duplicate by name combo
    console.log('\nAttempting to create staff file with duplicate name combination...');
    const dupNameRes = await fetch(`${BASE_URL}/registry/files/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hrToken}`
        },
        body: JSON.stringify({
            surname: testSurname.toLowerCase(), // testing case-insensitive
            otherNames: ' ' + testOtherNames + ' ', // testing trim
            email: 'diff.email2@noun.edu.ng',
            role: 'STAFF',
            level: 'CONTISS 7',
            step: '1',
            cadre: 'ADMINISTRATIVE',
            phone: '08088888888',
            stateOfOrigin: 'Lagos',
            lga: 'Ikeja',
            address: '123 Test Road'
        })
    });

    if (dupNameRes.ok) {
        throw new Error('Expected duplicate name check to fail, but it succeeded.');
    }
    const dupNameErr = await dupNameRes.json() as any;
    console.log(`Blocked duplicate name combo check as expected. Error message: ${dupNameErr.message}`);
    if (!dupNameErr.message.includes('name already exists')) {
        throw new Error(`Unexpected error message: ${dupNameErr.message}`);
    }

    // 7. Delete the staff file (representing HR deleting the file)
    console.log(`\nHR Admin deleting staff file with Staff ID ${initialStaffId}...`);
    const deleteRes = await fetch(`${BASE_URL}/registry/files/${encodeURIComponent(initialStaffId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${hrToken}` }
    });

    if (!deleteRes.ok) {
        throw new Error(`Delete staff file failed: ${await deleteRes.text()}`);
    }
    console.log('Deleted staff file successfully.');

    // 8. Recreate the staff file (should succeed now that it is deleted)
    console.log('\nRecreating staff file after deletion...');
    const recreateRes = await fetch(`${BASE_URL}/registry/files/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hrToken}`
        },
        body: JSON.stringify({
            surname: testSurname,
            otherNames: testOtherNames,
            email: testEmail,
            role: 'STAFF',
            level: 'CONTISS 7',
            step: '1',
            cadre: 'ADMINISTRATIVE',
            phone: testPhone,
            stateOfOrigin: 'Lagos',
            lga: 'Ikeja',
            address: '123 Test Road'
        })
    });

    if (!recreateRes.ok) {
        throw new Error(`Recreating staff file failed after deletion: ${await recreateRes.text()}`);
    }
    const recreateData = await recreateRes.json() as any;
    console.log(`Recreated staff file successfully. Staff ID: ${recreateData.staffId}`);

    // 9. Clean up recreated staff file
    console.log(`\nHR Admin cleaning up staff file with Staff ID ${recreateData.staffId}...`);
    const cleanupRes = await fetch(`${BASE_URL}/registry/files/${encodeURIComponent(recreateData.staffId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${hrToken}` }
    });

    if (!cleanupRes.ok) {
        throw new Error(`Cleanup failed: ${await cleanupRes.text()}`);
    }
    console.log('Cleanup successful.');

    console.log('\n--- ALL DUPLICATE STAFF FILE PREVENTION TESTS COMPLETED SUCCESSFULLY! ---');
}

main()
    .catch((err) => {
        console.error('Test script failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
