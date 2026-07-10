import { requireRole } from './middleware/auth.middleware';
import { encrypt, decrypt } from './services/encryption';
import { Role } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';

// Test runner function to verify core security requirements
async function runTests() {
    console.log('\n======================================================');
    console.log('🧪 Running University Clinic & Security Auth Unit Tests');
    console.log('======================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, testName: string) {
        if (condition) {
            console.log(`✅ Passed: ${testName}`);
            passed++;
        } else {
            console.error(`❌ Failed: ${testName}`);
            failed++;
        }
    }

    // Test 1: Medical History Encryption/Decryption
    try {
        const secretNotes = 'Patient has a mild allergy to penicillin and high BP history.';
        const encrypted = encrypt(secretNotes);
        assert(encrypted !== secretNotes, 'Encryption obscures clinical notes from plain view');
        
        const decrypted = decrypt(encrypted);
        assert(decrypted === secretNotes, 'Decryption correctly restores encrypted medical records');
    } catch (e: any) {
        console.error('Test 1 Exception:', e);
        failed++;
    }

    // Mock Express Request, Response and Next handler objects
    const mockResponse = () => {
        const resObj: any = {};
        resObj.status = (code: number) => {
            resObj.statusCode = code;
            return resObj as Response;
        };
        resObj.json = (data: any) => {
            resObj.body = data;
            return resObj as Response;
        };
        return resObj as Response;
    };

    // Test 2: Regular STAFF is blocked from accessing Clinic Patient Files
    try {
        const req = {
            user: { id: 'user-1', role: Role.STAFF }
        } as any;
        
        const res = mockResponse();
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        // Access Patient Files endpoint requires NURSE, DOCTOR or System Admins
        const middleware = requireRole([Role.CLINIC_NURSE, Role.CLINIC_DOCTOR]);
        middleware(req, res, next);

        assert(!nextCalled, 'Regular STAFF is blocked from accessing patient files');
        assert(res.statusCode === 403, 'STAFF receives a 403 Forbidden code');
    } catch (e: any) {
        console.error('Test 2 Exception:', e);
        failed++;
    }

    // Test 3: CLINIC_DOCTOR is permitted to access Clinic Patient Files
    try {
        const req = {
            user: { id: 'user-doc', role: Role.CLINIC_DOCTOR }
        } as any;
        
        const res = mockResponse();
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        const middleware = requireRole([Role.CLINIC_NURSE, Role.CLINIC_DOCTOR]);
        middleware(req, res, next);

        assert(nextCalled, 'CLINIC_DOCTOR is authorized to access clinic files');
    } catch (e: any) {
        console.error('Test 3 Exception:', e);
        failed++;
    }

    // Test 4: Regular STAFF is blocked from accessing Command Center rosters
    try {
        const req = {
            user: { id: 'user-1', role: Role.STAFF }
        } as any;
        
        const res = mockResponse();
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        const middleware = requireRole([Role.SECURITY_HEAD]);
        middleware(req, res, next);

        assert(!nextCalled, 'Regular STAFF is blocked from security shift rosters');
        assert(res.statusCode === 403, 'STAFF receives 403 Forbidden code on security routes');
    } catch (e: any) {
        console.error('Test 4 Exception:', e);
        failed++;
    }

    // Test 5: SECURITY_HEAD is permitted to manage Command Center rosters
    try {
        const req = {
            user: { id: 'user-head', role: Role.SECURITY_HEAD }
        } as any;
        
        const res = mockResponse();
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        const middleware = requireRole([Role.SECURITY_HEAD]);
        middleware(req, res, next);

        assert(nextCalled, 'SECURITY_HEAD is authorized to access shift rosters');
    } catch (e: any) {
        console.error('Test 5 Exception:', e);
        failed++;
    }

    // Test 6: SUPER_USER (System Admin) bypasses requireRole entirely
    try {
        const req = {
            user: { id: 'user-admin', role: Role.SUPER_USER }
        } as any;
        
        const res = mockResponse();
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        const middleware = requireRole([Role.SECURITY_HEAD]);
        middleware(req, res, next);

        assert(nextCalled, 'SUPER_USER bypasses role check to access security headers');
    } catch (e: any) {
        console.error('Test 6 Exception:', e);
        failed++;
    }

    console.log('\n======================================================');
    console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('======================================================\n');
    
    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
