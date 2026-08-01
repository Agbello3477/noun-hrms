import prisma from '../prisma';
import { resumeFromLeave } from '../controllers/leave.controller';
import { runLeaveResumptionJob } from '../jobs/leaveResumptionCron';
import { Request, Response } from 'express';
import { enableDbMock } from './dbMock';

async function runTests() {
    await enableDbMock();
    console.log('🧪 Starting Leave Resumption Backend Integration Tests...');
    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, message: string) => {
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${message}`);
            failed++;
        }
    };

    try {
        console.log('🔄 Setting up temporary test user on leave...');

        // 1. Create a test user & profile with status ON_LEAVE
        const testUser = await prisma.user.create({
            data: {
                email: 'leave_resumed_test@noun.edu.ng',
                password: 'password123',
                name: 'Mr. Leave Resumer',
                role: 'STAFF',
                staffProfile: {
                    create: {
                        surname: 'Resumer',
                        otherNames: 'Leave',
                        staffId: 'ST-LEAVE-999',
                        status: 'ON_LEAVE',
                        cadre: 'ADMINISTRATIVE'
                    }
                }
            },
            include: {
                staffProfile: true
            }
        });

        const staffId = testUser.staffProfile!.id;

        // 2. Create an APPROVED leave request ending in the future (early resumption scenario)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 5);

        const activeLeave = await prisma.leaveRequest.create({
            data: {
                staffId: staffId,
                type: 'CASUAL',
                startDate: new Date(),
                endDate: tomorrow,
                durationDays: 6,
                reason: 'Family urgent matters',
                status: 'APPROVED'
            }
        });

        // Mock express Request & Response to trigger resumeFromLeave controller
        const req = {
            user: { id: testUser.id, role: 'STAFF' },
            body: { staffId: staffId }
        } as unknown as Request;

        let responseMessage = '';
        const res = {
            json: (data: any) => {
                responseMessage = data.message;
                return res;
            },
            status: (code: number) => {
                return res;
            }
        } as unknown as Response;

        console.log('🔄 Performing manual early resumption...');
        await resumeFromLeave(req, res);

        // Fetch updated profiles/requests
        const updatedStaff = await prisma.staffProfile.findUnique({
            where: { id: staffId }
        });
        const updatedLeave = await prisma.leaveRequest.findUnique({
            where: { id: activeLeave.id }
        });

        assert(responseMessage.includes('Successfully resumed'), 'Resumption API returned successful response message');
        assert(updatedStaff?.status === 'ACTIVE', 'Staff status successfully reverted to ACTIVE');
        assert(
            new Date(updatedLeave!.endDate).toDateString() === new Date().toDateString(),
            'Leave end date correctly updated to today (early resumption recorded)'
        );
        assert(updatedLeave!.durationDays === 1, 'Leave request durationDays corrected to 1 day');

        // Let async notifications complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify notification
        const notifications = await prisma.notification.findMany({
            where: { userId: testUser.id }
        });
        assert(notifications.length > 0, 'In-app notification created for staff member');
        assert(notifications[0].title === 'Resumed From Leave', 'Notification has correct resumption title');

        // --- Test Case 2: Automated Resumption Cron Job ---
        console.log('🔄 Setting up automated resumption test case (ended leave)...');

        // Change staff status back to ON_LEAVE
        await prisma.staffProfile.update({
            where: { id: staffId },
            data: { status: 'ON_LEAVE' }
        });

        // Set leave request end date to yesterday (ended leave)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        await prisma.leaveRequest.update({
            where: { id: activeLeave.id },
            data: {
                startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                endDate: yesterday,
                durationDays: 4
            }
        });

        console.log('🔄 Executing automated leave resumption cron job scan...');
        const cronResult = await runLeaveResumptionJob();

        const postCronStaff = await prisma.staffProfile.findUnique({
            where: { id: staffId }
        });

        assert(cronResult.processed === 1, 'Cron job successfully processed 1 ended leave resumption');
        assert(postCronStaff?.status === 'ACTIVE', 'Cron job restored status of ended-leave staff to ACTIVE');

        // Clean up
        console.log('🧹 Cleaning up temporary test data...');
        await prisma.notification.deleteMany({
            where: { userId: testUser.id }
        });
        await prisma.leaveRequest.delete({
            where: { id: activeLeave.id }
        });
        await prisma.staffProfile.delete({
            where: { id: staffId }
        });
        await prisma.user.delete({
            where: { id: testUser.id }
        });

    } catch (e) {
        console.error('❌ Fatal error during test execution:', e);
        failed++;
    }

    console.log(`\n🎉 Leave Resumption Tests complete: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
