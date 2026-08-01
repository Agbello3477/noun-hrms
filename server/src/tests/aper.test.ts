import prisma from '../prisma';
import { updateSession } from '../controllers/aper.controller';
import { Request, Response } from 'express';
import { enableDbMock } from './dbMock';

async function runTests() {
    await enableDbMock();
    console.log('🧪 Starting APER Session Activation Notification Tests...');
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
        console.log('🔄 Setting up temporary test users for APER...');

        // 1. Create Academic User & Profile
        const academicUser = await prisma.user.create({
            data: {
                email: 'academic_test@noun.edu.ng',
                password: 'password123',
                name: 'Prof. Academic Test',
                role: 'STAFF',
                staffProfile: {
                    create: {
                        surname: 'Test',
                        otherNames: 'Academic',
                        staffId: 'ST-ACAD-001',
                        cadre: 'ACADEMIC'
                    }
                }
            }
        });

        // 2. Create Non-Academic User & Profile
        const adminUser = await prisma.user.create({
            data: {
                email: 'admin_test@noun.edu.ng',
                password: 'password123',
                name: 'Mr. Admin Test',
                role: 'STAFF',
                staffProfile: {
                    create: {
                        surname: 'Test',
                        otherNames: 'Admin',
                        staffId: 'ST-ADMIN-001',
                        cadre: 'ADMINISTRATIVE'
                    }
                }
            }
        });

        // 3. Create an inactive APER session
        const session = await prisma.aperSession.create({
            data: {
                title: 'Test Appraisal Cycle 2026',
                year: 2026,
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                isActive: false
            }
        });

        // Mock express Request & Response to trigger updateSession controller
        const req = {
            params: { id: session.id },
            body: {
                title: session.title,
                startDate: session.startDate,
                endDate: session.endDate,
                isActive: true // Toggle on!
            }
        } as unknown as Request;

        let responseData: any = null;
        const res = {
            json: (data: any) => {
                responseData = data;
                return res;
            },
            status: (code: number) => {
                return res;
            }
        } as unknown as Response;

        console.log('🔄 Toggling APER session to active...');
        await updateSession(req, res);

        assert(responseData !== null, 'Session updated response received successfully');
        assert(responseData?.isActive === true, 'Session successfully updated to active');

        // Let async notifications complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // 4. Verify in-app notifications
        const academicNotifications = await prisma.notification.findMany({
            where: { userId: academicUser.id }
        });
        const adminNotifications = await prisma.notification.findMany({
            where: { userId: adminUser.id }
        });

        assert(
            academicNotifications.length === 0,
            'Academic staff member did NOT receive any APER session activation notifications'
        );
        assert(
            adminNotifications.length === 1,
            'Non-Academic staff member received exactly 1 in-app APER session activation notification'
        );
        assert(
            adminNotifications[0]?.title === 'Annual Performance Appraisal (APER) Session Opened',
            'Non-Academic notification has correct APER session title'
        );

        console.log('🧹 Cleaning up temporary database records...');
        await prisma.notification.deleteMany({
            where: { userId: { in: [academicUser.id, adminUser.id] } }
        });
        await prisma.staffProfile.deleteMany({
            where: { userId: { in: [academicUser.id, adminUser.id] } }
        });
        await prisma.user.deleteMany({
            where: { id: { in: [academicUser.id, adminUser.id] } }
        });
        await prisma.aperSession.delete({
            where: { id: session.id }
        });

    } catch (e) {
        console.error('❌ Fatal error during test execution:', e);
        failed++;
    }

    console.log(`\n🎉 APER Session Tests complete: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
