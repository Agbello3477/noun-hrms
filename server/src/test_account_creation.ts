import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5055/api';

async function main() {
    console.log('--- STARTING ACCOUNT CREATION & PASSWORD FORCE RESET E2E TESTS ---');

    const testStaffEmail = 'test.newstaff@noun.edu.ng';

    // 1. Cleanup old test staff
    console.log('\nCleaning up old test user/profile...');
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
        console.log('Cleaned up old test user.');
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

    // 3. Create a staff file (representing HR creating a file)
    console.log('\nCreating new staff file...');
    const createRes = await fetch(`${BASE_URL}/registry/files/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hrToken}`
        },
        body: JSON.stringify({
            surname: 'Test',
            otherNames: 'NewStaff',
            email: testStaffEmail,
            role: 'STAFF',
            level: 'CONTISS 7',
            step: '1',
            cadre: 'ADMINISTRATIVE',
            phone: '08099887766',
            stateOfOrigin: 'Lagos',
            lga: 'Ikeja',
            address: '123 Test Street'
        })
    });

    if (!createRes.ok) {
        throw new Error(`Failed to create staff file: ${await createRes.text()}`);
    }
    const createData = await createRes.json() as any;
    const staffId = createData.staffId;
    console.log(`Staff file created successfully. Staff ID: ${staffId}`);

    // 4. Verify in DB that mustChangePassword is true, and check default password fallback works
    console.log('\nChecking user flags in database...');
    const createdUser = await prisma.user.findUnique({
        where: { email: testStaffEmail }
    });
    if (!createdUser) {
        throw new Error('User was not created in the database.');
    }
    console.log('User model found in database:', {
        email: createdUser.email,
        mustChangePassword: createdUser.mustChangePassword
    });
    if (createdUser.mustChangePassword !== true) {
        throw new Error('Expected mustChangePassword to be true, but it was false');
    }

    // 5. Attempt login with default password '123456789' (using Staff ID)
    console.log(`\nAttempting login with Staff ID "${staffId}" and password "123456789"...`);
    const staffIdLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: staffId, // Testing Staff ID login
            password: '123456789',
            loginType: 'GENERAL'
        })
    });
    if (!staffIdLoginRes.ok) {
        throw new Error(`Staff login by Staff ID failed: ${await staffIdLoginRes.text()}`);
    }
    const staffIdLoginData = await staffIdLoginRes.json() as any;
    console.log('Staff ID Login successful. User object in response:', {
        email: staffIdLoginData.user.email,
        mustChangePassword: staffIdLoginData.user.mustChangePassword
    });
    if (staffIdLoginData.user.mustChangePassword !== true) {
        throw new Error('Expected mustChangePassword to be true');
    }

    // 5b. Attempt login with default password '123456789' (using Email)
    console.log(`\nAttempting login with Email "${testStaffEmail}" and password "123456789"...`);
    const newStaffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: testStaffEmail, // Testing Email login
            password: '123456789',
            loginType: 'GENERAL'
        })
    });
    if (!newStaffLoginRes.ok) {
        throw new Error(`New staff login by Email failed: ${await newStaffLoginRes.text()}`);
    }
    const newStaffLoginData = await newStaffLoginRes.json() as any;
    console.log('Email Login successful. User object in response:', {
        email: newStaffLoginData.user.email,
        mustChangePassword: newStaffLoginData.user.mustChangePassword
    });
    if (newStaffLoginData.user.mustChangePassword !== true) {
        throw new Error('Expected mustChangePassword in login response to be true');
    }
    const newStaffToken = newStaffLoginData.token;

    // 6. Attempt password change to 'newSecurePassword123'
    console.log('\nChanging password using /auth/change-password...');
    const changePasswordRes = await fetch(`${BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newStaffToken}`
        },
        body: JSON.stringify({
            currentPassword: '123456789',
            newPassword: 'newSecurePassword123'
        })
    });
    if (!changePasswordRes.ok) {
        throw new Error(`Change password failed: ${await changePasswordRes.text()}`);
    }
    const changePasswordData = await changePasswordRes.json() as any;
    console.log('Password change response:', changePasswordData);

    // 7. Verify mustChangePassword is false in the database
    console.log('\nChecking user flags in database after password change...');
    const updatedUser = await prisma.user.findUnique({
        where: { email: testStaffEmail }
    });
    if (!updatedUser) {
        throw new Error('User was not found in the database after password change.');
    }
    console.log('Updated User model in database:', {
        email: updatedUser.email,
        mustChangePassword: updatedUser.mustChangePassword
    });
    if (updatedUser.mustChangePassword !== false) {
        throw new Error('Expected mustChangePassword to be false after password change, but it was true');
    }

    // 8. Clean up
    console.log('\nCleaning up test user/profile...');
    if (updatedUser) {
        const profile = await prisma.staffProfile.findFirst({
            where: { staffId }
        });
        if (profile) {
            await prisma.staffProfile.delete({ where: { id: profile.id } });
        }
        await prisma.notification.deleteMany({ where: { userId: updatedUser.id } });
        await prisma.auditLog.deleteMany({ where: { userId: updatedUser.id } });
        await prisma.user.delete({ where: { id: updatedUser.id } });
        console.log('Cleaned up test user.');
    }

    console.log('\n--- ALL TESTS COMPLETED SUCCESSFULLY! ---');
}

main()
    .catch((err) => {
        console.error('Test script failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
