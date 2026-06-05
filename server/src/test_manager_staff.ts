import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5055/api';

async function main() {
    console.log('--- STARTING MANAGER STAFF PERMISSIONS E2E TESTS ---');

    const testStaffEmail = 'test.managerstaff@noun.edu.ng';

    // Cleanup old test staff
    const existingTestUser = await prisma.user.findUnique({
        where: { email: testStaffEmail }
    });
    if (existingTestUser) {
        await prisma.staffProfile.deleteMany({ where: { userId: existingTestUser.id } });
        await prisma.user.delete({ where: { id: existingTestUser.id } });
        console.log('Cleaned up old test staff.');
    }

    // 1. Log in as Study Center Manager
    console.log('\nLogging in Study Center Manager (Lagos Study Center)...');
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

    // 2. Fetch the SC Manager profile to verify their center placement
    const scmMeRes = await fetch(`${BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${scmToken}` }
    });
    const scmMe = await scmMeRes.json() as any;
    const scmCenterId = scmMe.staffProfile?.centerId;
    console.log(`SC Manager Center Placement ID: ${scmCenterId} (${scmMe.staffProfile?.studyCenter?.name})`);
    if (!scmCenterId) {
        throw new Error('Study Center Manager is not placed in any center!');
    }

    // 3. Create a staff member as SC Manager
    console.log('\nCreating new staff as SC Manager...');
    const createRes = await fetch(`${BASE_URL}/staff`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${scmToken}`
        },
        body: JSON.stringify({
            surname: 'ManagerStaff',
            otherNames: 'Test',
            email: testStaffEmail,
            role: 'STAFF',
            staffId: 'TESTSCM01',
            level: 'CONTISS 7',
            step: '1',
            cadre: 'ADMINISTRATIVE',
            phone: '08012345678',
            stateOfOrigin: 'Lagos',
            lga: 'Ikeja',
            address: 'Lagos Study Center Road',
            // Try to specify an arbitrary unitId (Faculty of Sciences unitId: c07a900a-5c97-4d9e-acbf-cdd212cb713a)
            unitId: 'c07a900a-5c97-4d9e-acbf-cdd212cb713a',
            centerId: 'some-other-center-id'
        })
    });
    if (!createRes.ok) {
        throw new Error(`Failed to create staff: ${await createRes.text()}`);
    }
    const createData = await createRes.json() as any;
    const createdStaffId = createData.user.id;
    console.log(`Staff created successfully. ID: ${createdStaffId}`);

    // Verify database placement is auto-bound to Lagos Study Center (scmCenterId) and unitId is null/override
    const createdProfile = await prisma.staffProfile.findUnique({
        where: { userId: createdStaffId }
    });
    if (!createdProfile || createdProfile.centerId !== scmCenterId || createdProfile.unitId) {
        throw new Error(`Placement auto-binding validation failed. Expected centerId to be ${scmCenterId} and unitId to be null/override. Got centerId: ${createdProfile?.centerId}, unitId: ${createdProfile?.unitId}`);
    }
    console.log('Auto-binding verification passed: Staff placement matches Manager center.');

    // 4. Update the created staff member's bio/career details as SC Manager
    console.log('\nUpdating created staff career details...');
    const updateRes = await fetch(`${BASE_URL}/staff/${createdStaffId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${scmToken}`
        },
        body: JSON.stringify({
            surname: 'ManagerStaffUpdate',
            otherNames: 'TestUpdated',
            phone: '08098765432',
            address: 'Updated Address',
            level: 'CONTISS 8',
            step: '2',
            cadre: 'ADMINISTRATIVE',
            rank: 'Senior Admin Officer',
            gender: 'Male',
            // Attempt to update restricted fields: role, centerId
            role: 'HR_ADMIN',
            centerId: '350bdea2-f02c-41b6-baa3-c20d645f54a6' // Abuja Model
        })
    });
    if (!updateRes.ok) {
        throw new Error(`Failed to update staff: ${await updateRes.text()}`);
    }
    console.log('Update API responded successfully.');

    // Fetch the updated staff profile from DB and verify updates
    const updatedUser = await prisma.user.findUnique({
        where: { id: createdStaffId },
        include: { staffProfile: true }
    });
    if (!updatedUser || !updatedUser.staffProfile) {
        throw new Error('Staff not found after update.');
    }

    // Verify bio/career changes were saved
    if (
        updatedUser.staffProfile.surname !== 'ManagerStaffUpdate' ||
        updatedUser.staffProfile.level !== 'CONTISS 8' ||
        updatedUser.staffProfile.step !== '2' ||
        updatedUser.staffProfile.rank !== 'Senior Admin Officer'
    ) {
        throw new Error('Bio/career details update failed to save to database.');
    }
    console.log('Bio/career updates successfully saved.');

    // Verify system role and placement remained unchanged (restricted)
    if (updatedUser.role === 'HR_ADMIN' || updatedUser.staffProfile.centerId !== scmCenterId) {
        throw new Error(`Restricted fields were modified by manager! Role: ${updatedUser.role}, centerId: ${updatedUser.staffProfile.centerId}`);
    }
    console.log('Restricted fields verification passed (role and placement remained secure).');

    // 5. Try to view a staff member outside manager's boundary (Abuja Model Study Centre Staff: john.doe.test@noun.edu.ng)
    const outsiderStaff = await prisma.user.findUnique({
        where: { email: 'john.doe.test@noun.edu.ng' },
        include: { staffProfile: true }
    });
    if (!outsiderStaff) {
        throw new Error('Outsider staff not found in database.');
    }
    console.log(`\nAttempting to view outsider staff ${outsiderStaff.email} (Abuja Model Centre)...`);
    const viewOutsiderRes = await fetch(`${BASE_URL}/staff/${outsiderStaff.id}`, {
        headers: { 'Authorization': `Bearer ${scmToken}` }
    });
    if (viewOutsiderRes.status !== 403) {
        throw new Error(`Expected 403 Forbidden for outsider view, but got: ${viewOutsiderRes.status}`);
    }
    console.log('Outsider view check passed (returned 403 Forbidden).');

    // 5b. Simulate a transfer: create a transfer log showing the outsider was formerly at Lagos Study Center
    console.log(`\nSimulating transfer: Creating transfer log for ${outsiderStaff.email} from Lagos...`);
    const dummyTransferLog = await prisma.transferLog.create({
        data: {
            staffId: outsiderStaff.id,
            oldCenterId: scmCenterId,
            newCenterId: outsiderStaff.staffProfile?.centerId || 'Unknown',
            initiatedById: scmMe.id,
            reason: 'Test Transfer'
        }
    });

    console.log(`Attempting to view formerly managed staff (transferred out)...`);
    const viewTransferredRes = await fetch(`${BASE_URL}/staff/${outsiderStaff.id}`, {
        headers: { 'Authorization': `Bearer ${scmToken}` }
    });
    if (!viewTransferredRes.ok) {
        throw new Error(`Expected 200 OK for transferred staff view, but got: ${viewTransferredRes.status}`);
    }
    console.log('Transferred staff view check passed (returned 200 OK).');

    // Clean up transfer log
    await prisma.transferLog.delete({
        where: { id: dummyTransferLog.id }
    });
    console.log('Cleaned up dummy transfer log.');

    // 6. Try to update a staff member outside manager's boundary
    console.log(`\nAttempting to update outsider staff ${outsiderStaff.email}...`);
    const updateOutsiderRes = await fetch(`${BASE_URL}/staff/${outsiderStaff.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${scmToken}`
        },
        body: JSON.stringify({
            surname: 'HackedName'
        })
    });
    if (updateOutsiderRes.status !== 403) {
        throw new Error(`Expected 403 Forbidden for outsider update, but got: ${updateOutsiderRes.status}`);
    }
    console.log('Outsider update check passed (returned 403 Forbidden).');

    // Clean up
    console.log('\nCleaning up created E2E test staff...');
    await prisma.staffProfile.delete({ where: { userId: createdStaffId } });
    await prisma.user.delete({ where: { id: createdStaffId } });
    console.log('Cleanup complete.');

    console.log('\n--- ALL MANAGER PERMISSION E2E TESTS COMPLETED SUCCESSFULLY ---');
}

main()
    .catch((err) => {
        console.error('\nE2E Verification Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
