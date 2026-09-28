import prisma from '../prisma';
import { enableDbMock } from './dbMock';
import {
    Permission,
    ROLE_PERMISSIONS,
    hasPermission,
    requirePermission,
    requireImputerRole,
    requireAuthorizerRole,
    validateDualControlSelfAuthorization,
} from '../middleware/rbac.middleware';
import { Role } from '@prisma/client';

async function runTests() {
    await enableDbMock();
    console.log('🧪 Starting RBAC Maker-Checker Dual Control Integration Tests...');
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
        // --- 1. Permission Matrix Segregation Tests ---
        console.log('\n--- 1. Testing Permission Matrix Segregation ---');
        assert(
            hasPermission(Role.REGISTRY_ADMIN, Permission.CAN_IMPUTE_POSTING) === true,
            'REGISTRY_ADMIN possesses CAN_IMPUTE_POSTING'
        );
        assert(
            hasPermission(Role.REGISTRY_ADMIN, Permission.CAN_AUTHORIZE_POSTING) === false,
            'REGISTRY_ADMIN does NOT possess CAN_AUTHORIZE_POSTING'
        );
        assert(
            hasPermission(Role.HR_ADMIN, Permission.CAN_IMPUTE_STAFF_FILE) === true,
            'HR_ADMIN possesses CAN_IMPUTE_STAFF_FILE'
        );
        assert(
            hasPermission(Role.HR_ADMIN, Permission.CAN_CLEAR_STAFF_FILE) === false,
            'HR_ADMIN does NOT possess CAN_CLEAR_STAFF_FILE'
        );

        assert(
            hasPermission(Role.REGISTRAR, Permission.CAN_AUTHORIZE_POSTING) === true,
            'REGISTRAR possesses CAN_AUTHORIZE_POSTING'
        );
        assert(
            hasPermission(Role.REGISTRAR, Permission.CAN_IMPUTE_POSTING) === false,
            'REGISTRAR does NOT possess CAN_IMPUTE_POSTING'
        );
        assert(
            hasPermission(Role.DEPUTY_REGISTRAR, Permission.CAN_CLEAR_STAFF_FILE) === true,
            'DEPUTY_REGISTRAR possesses CAN_CLEAR_STAFF_FILE'
        );
        assert(
            hasPermission(Role.DEPUTY_REGISTRAR, Permission.CAN_IMPUTE_STAFF_FILE) === false,
            'DEPUTY_REGISTRAR does NOT possess CAN_IMPUTE_STAFF_FILE'
        );

        // --- 2. Middleware Segregation Tests (Simulated Express Req/Res) ---
        console.log('\n--- 2. Testing Middleware Guard Enforcement ---');

        const mockRes = () => {
            const res: any = {};
            res.statusCode = 200;
            res.status = (code: number) => {
                res.statusCode = code;
                return res;
            };
            res.json = (data: any) => {
                res.body = data;
                return res;
            };
            return res;
        };

        // Test 2a: Operational Imputer attempting to hit Authorizer endpoint
        let res = mockRes();
        let nextCalled = false;
        const imputerReq: any = { user: { id: 'imputer-1', role: Role.REGISTRY_ADMIN } };
        const authorizerGuard = requirePermission(Permission.CAN_AUTHORIZE_POSTING);
        authorizerGuard(imputerReq, res, () => { nextCalled = true; });

        assert(res.statusCode === 403, 'Imputer attempting authorizer action receives 403 Forbidden');
        assert(nextCalled === false, 'Next middleware was not called for imputer on authorizer route');

        // Test 2b: Authorizer attempting to draft/impute operational records
        res = mockRes();
        nextCalled = false;
        const registrarReq: any = { user: { id: 'registrar-1', role: Role.REGISTRAR } };
        const imputerGuard = requirePermission(Permission.CAN_IMPUTE_POSTING);
        imputerGuard(registrarReq, res, () => { nextCalled = true; });

        assert(res.statusCode === 403, 'Registrar attempting to impute draft posting receives 403 Forbidden');
        assert(nextCalled === false, 'Next middleware was not called for registrar on imputer route');

        // Test 2c: requireImputerRole guard rejects Registrar
        res = mockRes();
        nextCalled = false;
        requireImputerRole(registrarReq, res, () => { nextCalled = true; });
        assert(res.statusCode === 403, 'requireImputerRole rejects Registrar with 403');
        assert(nextCalled === false, 'requireImputerRole did not pass control');

        // Test 2d: requireAuthorizerRole guard rejects Registry Admin
        res = mockRes();
        nextCalled = false;
        requireAuthorizerRole(imputerReq, res, () => { nextCalled = true; });
        assert(res.statusCode === 403, 'requireAuthorizerRole rejects Registry Admin with 403');
        assert(nextCalled === false, 'requireAuthorizerRole did not pass control');

        // --- 3. Dual-Control Self-Authorization Rule Enforcement ---
        console.log('\n--- 3. Testing Dual-Control Self-Authorization Prevention ---');
        let selfAuthErrorCaught = false;
        try {
            validateDualControlSelfAuthorization('officer-same-uuid', 'officer-same-uuid');
        } catch (err: any) {
            selfAuthErrorCaught = true;
            assert(err.status === 403 || err.statusCode === 403, 'Self-authorization error carries HTTP 403 status');
            assert(err.message.includes('Self-authorization is strictly prohibited'), 'Self-authorization error message is informative');
        }
        assert(selfAuthErrorCaught === true, 'validateDualControlSelfAuthorization throws on identical imputer & authorizer');

        let validAuthErrorCaught = false;
        try {
            validateDualControlSelfAuthorization('imputer-uuid', 'registrar-uuid');
        } catch (err) {
            validAuthErrorCaught = true;
        }
        assert(validAuthErrorCaught === false, 'validateDualControlSelfAuthorization allows distinct imputer and authorizer IDs');

        // --- 4. Database Lifecycle & Dual-Control Audit Trail ---
        console.log('\n--- 4. Testing End-to-End Posting & Clearance Operations ---');
        const imputerId = 'imputer-user-123';
        const registrarId = 'registrar-user-456';
        const targetStaffProfileId = 'profile-test-789';

        // 4a: Imputer creates a draft transfer posting
        const draftPosting = await (prisma as any).transferLog.create({
            data: {
                staffProfileId: targetStaffProfileId,
                fromUnitId: 'unit-registry',
                toUnitId: 'unit-bursary',
                reason: 'Routine deployment to Bursary accounting',
                status: 'PENDING_REGISTRAR_APPROVAL',
                effectiveDate: new Date('2026-10-01'),
                imputedById: imputerId,
            }
        });

        assert(draftPosting.id !== undefined, 'Draft posting successfully created');
        assert(draftPosting.status === 'PENDING_REGISTRAR_APPROVAL', 'Draft posting enters PENDING_REGISTRAR_APPROVAL state');
        assert(draftPosting.imputedById === imputerId, 'Draft posting records imputer user ID');

        // 4b: Ensure self-authorization attempt on this draft posting fails
        let selfAuthPostingBlocked = false;
        try {
            validateDualControlSelfAuthorization(draftPosting.imputedById, imputerId);
        } catch (err) {
            selfAuthPostingBlocked = true;
        }
        assert(selfAuthPostingBlocked === true, 'Self-authorization on draft posting is strictly blocked');

        // 4c: Distinct authorizer clears posting & generates cryptographic audit trail
        validateDualControlSelfAuthorization(draftPosting.imputedById, registrarId);
        const authorizedPosting = await (prisma as any).transferLog.update({
            where: { id: draftPosting.id },
            data: {
                status: 'AUTHORIZED',
                remarks: 'Approved by the Registrar for statutory posting',
            }
        });
        assert(authorizedPosting.status === 'AUTHORIZED', 'Posting transitioned to AUTHORIZED status');

        const auditTrail = await (prisma as any).authorizationAuditTrail.create({
            data: {
                entityType: 'STAFF_POSTING',
                entityId: authorizedPosting.id,
                imputerId: draftPosting.imputedById,
                authorizerId: registrarId,
                actionTaken: 'AUTHORIZED',
                remarks: 'Statutory approval granted',
                digitalStampRef: 'NOUN-REG-SEAL-2026-XYZ123',
                ipAddress: '10.0.0.1',
                userAgent: 'Noun-Registrar-Console/1.0',
            }
        });

        assert(auditTrail.id !== undefined, 'Authorization audit trail record was generated');
        assert(auditTrail.entityType === 'STAFF_POSTING', 'Audit trail entityType matches STAFF_POSTING');
        assert(auditTrail.actionTaken === 'AUTHORIZED', 'Audit trail actionTaken matches AUTHORIZED');
        assert(auditTrail.digitalStampRef === 'NOUN-REG-SEAL-2026-XYZ123', 'Cryptographic digital stamp reference recorded');

        // 4d: Staff File Creation & Activation Clearance
        console.log('\n--- 5. Testing Digital Staff File Clearance & Activation ---');
        const candidateUser = await (prisma.user as any).create({
            data: {
                id: 'new-hire-user-999',
                email: 'newhire@noun.edu.ng',
                name: 'New Hire Lecturer',
                role: 'STAFF',
                staffProfile: {
                    create: {
                        surname: 'Hire',
                        otherNames: 'New',
                        staffId: 'NOUN-2026-999',
                        status: 'PENDING_REGISTRAR_CLEARANCE',
                    }
                }
            }
        });

        assert(candidateUser.staffProfile.status === 'PENDING_REGISTRAR_CLEARANCE', 'New staff profile initiates as PENDING_REGISTRAR_CLEARANCE');

        // Authorizer performs clearance:
        const clearedProfile = await (prisma.staffProfile as any).update({
            where: { id: candidateUser.staffProfile.id },
            data: { status: 'CLEARED_ACTIVE' }
        });
        assert(clearedProfile.status === 'CLEARED_ACTIVE', 'Staff profile cleared to CLEARED_ACTIVE');

        const fileAuditTrail = await (prisma as any).authorizationAuditTrail.create({
            data: {
                entityType: 'STAFF_FILE',
                entityId: candidateUser.staffProfile.id,
                imputerId: imputerId,
                authorizerId: registrarId,
                actionTaken: 'AUTHORIZED',
                remarks: 'Dossier documents verified and approved',
                digitalStampRef: 'NOUN-REG-CLEARANCE-999',
            }
        });

        assert(fileAuditTrail.entityType === 'STAFF_FILE', 'File clearance recorded in authorization audit trail');
        assert(fileAuditTrail.digitalStampRef === 'NOUN-REG-CLEARANCE-999', 'Clearance seal reference stored');

        console.log(`\n================================`);
        console.log(`🎉 RBAC Maker-Checker Tests Completed!`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`================================\n`);

        if (failed > 0) {
            process.exit(1);
        }
    } catch (e: any) {
        console.error('Test execution failed with error:', e);
        process.exit(1);
    }
}

runTests();
