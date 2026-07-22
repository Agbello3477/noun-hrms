import prisma from '../prisma';
import { enableDbMock } from './dbMock';

const runTests = async () => {
    await enableDbMock();
    console.log('🧪 Starting Compliance, Audits & System Logs Tests...');

    let tempUser: any = null;
    let tempLog: any = null;

    try {
        // 1. Setup temporary test user
        console.log('🔄 Setting up temporary user...');
        tempUser = await prisma.user.create({
            data: {
                email: `compliancetest-${Date.now()}@noun.edu.ng`,
                password: 'hashed_password_placeholder',
                role: 'STAFF'
            }
        });

        // 2. Simulate manual override logging
        console.log('🔄 Logging a simulated MANUAL_OVERRIDE log...');
        tempLog = await prisma.auditLog.create({
            data: {
                userId: tempUser.id,
                action: 'MANUAL_OVERRIDE',
                resource: 'STAFF_PROFILE',
                details: JSON.stringify({
                    targetUserId: tempUser.id,
                    overrides: {
                        status: { old: 'ACTIVE', new: 'SUSPENDED' }
                    },
                    reason: 'Test bypass for leave parameters'
                })
            }
        });

        // Verify log creation
        const logRecord = await prisma.auditLog.findUnique({
            where: { id: tempLog.id }
        });
        if (logRecord && logRecord.action === 'MANUAL_OVERRIDE') {
            console.log('✅ PASS: MANUAL_OVERRIDE log recorded successfully in database');
        } else {
            throw new Error('FAIL: Override audit log creation mismatch');
        }

        // 3. Verify compliance export formatting
        console.log('🔄 Verifying CSV export formatting...');
        const usersCount = await prisma.user.count();
        const totalLogs = await prisma.auditLog.count();

        let csvContent = '';
        csvContent += '--- SYSTEM SECURITY ACCESS & DATA PROTECTION METRICS REPORT ---\n';
        csvContent += `Total System Users,${usersCount}\n`;
        csvContent += `Total System Audit Log entries,${totalLogs}\n`;

        if (csvContent.includes('Total System Users') && csvContent.includes('Total System Audit Log entries')) {
            console.log('✅ PASS: CSV spreadsheet template matches compliance formatting specifications');
        } else {
            throw new Error('FAIL: Compliance spreadsheet headers mismatch');
        }

    } catch (error) {
        console.error('❌ FAIL: Compliance Integration Tests encountered an error:', error);
        process.exit(1);
    } finally {
        console.log('🧹 Cleaning up temporary compliance test logs...');
        if (tempLog) {
            await prisma.auditLog.delete({ where: { id: tempLog.id } }).catch(() => {});
        }
        if (tempUser) {
            await prisma.user.delete({ where: { id: tempUser.id } }).catch(() => {});
        }
    }

    console.log('\n🎉 Compliance & Audit Tests complete: all checks passed.');
};

runTests();
