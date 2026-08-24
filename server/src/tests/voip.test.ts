import prisma from '../prisma';
import { getVoipDirectory, lookupExtension, getIceServers } from '../controllers/voip.controller';
import { Request, Response } from 'express';
import { enableDbMock } from './dbMock';

async function runTests() {
  await enableDbMock();
  console.log('🧪 Starting VoIP & Extension Intercom Integration Tests...');
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
    console.log('🔄 Setting up temporary test user with 4-digit VoIP extension...');

    // 1. Create a test user & profile with 4-digit VoIP Extension 1001
    const testUser = await prisma.user.create({
      data: {
        email: 'voip_tester_1001@noun.edu.ng',
        password: 'password123',
        name: 'Capt. VoIP Test',
        role: 'SUPER_USER',
        staffProfile: {
          create: {
            surname: 'Test',
            otherNames: 'VoIP',
            staffId: 'ST-VOIP-1001',
            status: 'ACTIVE',
            voipExtension: '1001'
          }
        }
      },
      include: {
        staffProfile: true
      }
    });

    // 2. Test GET /api/voip/directory controller
    const reqDir = {
      query: { query: '1001' },
      user: { id: testUser.id, role: 'SUPER_USER' }
    } as unknown as Request;

    let dirResponseData: any = null;
    const resDir = {
      status: (code: number) => resDir,
      json: (data: any) => {
        dirResponseData = data;
        return resDir;
      }
    } as unknown as Response;

    await getVoipDirectory(reqDir, resDir);

    assert(Array.isArray(dirResponseData), 'getVoipDirectory returns an array of staff profiles');
    const matchedProfile = dirResponseData.find((p: any) => p.extension === '1001');
    assert(!!matchedProfile, 'Directory includes created test extension 1001');
    assert(matchedProfile?.name.includes('VoIP') || matchedProfile?.name.includes('Test'), 'Directory returns full name');

    // 3. Test GET /api/voip/lookup/:extension controller
    const reqLookup = {
      params: { extension: '1001' },
      user: { id: testUser.id, role: 'SUPER_USER' }
    } as unknown as Request;

    let lookupData: any = null;
    const resLookup = {
      status: (code: number) => resLookup,
      json: (data: any) => {
        lookupData = data;
        return resLookup;
      }
    } as unknown as Response;

    await lookupExtension(reqLookup, resLookup);

    assert(lookupData?.extension === '1001', 'lookupExtension successfully resolves extension 1001');
    assert(lookupData?.status === 'ACTIVE', 'Resolved extension status is ACTIVE');

    // 4. Test Invalid Short Extension
    const reqInvalid = {
      params: { extension: '12' },
      user: { id: testUser.id, role: 'SUPER_USER' }
    } as unknown as Request;

    let invalidErrCode = 200;
    const resInvalid = {
      status: (code: number) => {
        invalidErrCode = code;
        return resInvalid;
      },
      json: (data: any) => resInvalid
    } as unknown as Response;

    await lookupExtension(reqInvalid, resInvalid);
    assert(invalidErrCode === 400, 'lookupExtension rejects short/invalid extension with 400 status');

    // 5. Test ICE Servers controller
    const reqIce = {} as Request;
    let iceData: any = null;
    const resIce = {
      status: (code: number) => resIce,
      json: (data: any) => {
        iceData = data;
        return resIce;
      }
    } as unknown as Response;

    await getIceServers(reqIce, resIce);

    assert(Array.isArray(iceData?.iceServers), 'getIceServers returns array of WebRTC ICE candidate servers');
    assert(iceData?.iceServers.length > 0, 'Google STUN servers configured properly');

    // Clean up
    console.log('🧹 Cleaning up temporary test user...');
    await prisma.staffProfile.delete({
      where: { userId: testUser.id }
    });
    await prisma.user.delete({
      where: { id: testUser.id }
    });

  } catch (e) {
    console.error('❌ Fatal error during test execution:', e);
    failed++;
  }

  console.log(`\n🎉 VoIP & Extension Intercom Integration Tests complete: ${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
