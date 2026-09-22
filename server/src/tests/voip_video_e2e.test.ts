import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import ioClient, { Socket as ClientSocket } from 'socket.io-client';
import express, { Request, Response } from 'express';
import prisma from '../prisma';
import { setupVoipSocket } from '../sockets/voip.socket';
import { getVoipDirectory, lookupExtension, getIceServers } from '../controllers/voip.controller';
import { enableDbMock } from './dbMock';

async function runVoipVideoE2ETests() {
  await enableDbMock();
  console.log('\n🚀 Starting Complete VoIP & Video Call End-to-End Verification Suite...\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, message: string) => {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  };

  // 1. Setup in-memory HTTP server and Socket.IO server
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: '*' }
  });

  // Mock socket authentication middleware
  io.use((socket: any, next: any) => {
    const token = socket.handshake.auth?.token;
    if (token === 'token-caller') {
      socket.user = { id: 'user-caller-101', name: 'Prof. Adamu Garba', role: 'STAFF' };
    } else if (token === 'token-callee') {
      socket.user = { id: 'user-callee-102', name: 'Dr. Ngozi Okonjo', role: 'STAFF' };
    } else {
      socket.user = { id: 'user-guest-103', name: 'Guest Staff', role: 'STAFF' };
    }
    next();
  });

  setupVoipSocket(io);

  const PORT = 8999;
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`📡 Test Signaling Server running on port ${PORT}`);

  try {
    // 2. Setup mock profiles in database
    console.log('\n--- TEST SUITE 1: Profile Extension Resolution & ICE Configuration ---');

    await prisma.user.create({
      data: {
        id: 'user-caller-101',
        email: 'adamu@noun.edu.ng',
        name: 'Prof. Adamu Garba',
        password: 'hashed_password_123',
        role: 'STAFF',
        staffProfile: {
          create: {
            id: 'profile-caller-101',
            surname: 'Garba',
            otherNames: 'Adamu',
            staffId: 'ST-1001',
            status: 'ACTIVE',
            voipExtension: '1001',
            rank: 'Professor'
          }
        }
      },
      include: { staffProfile: true }
    });

    await prisma.user.create({
      data: {
        id: 'user-callee-102',
        email: 'ngozi@noun.edu.ng',
        name: 'Dr. Ngozi Okonjo',
        password: 'hashed_password_123',
        role: 'STAFF',
        staffProfile: {
          create: {
            id: 'profile-callee-102',
            surname: 'Okonjo',
            otherNames: 'Ngozi',
            staffId: 'ST-1002',
            status: 'ACTIVE',
            voipExtension: '1002',
            rank: 'Senior Lecturer'
          }
        }
      },
      include: { staffProfile: true }
    });

    // Test ICE Servers
    const reqIce: any = { user: { id: 'user-caller-101' } };
    let iceResult: any = null;
    const resIce: any = {
      status: () => resIce,
      json: (d: any) => { iceResult = d; return resIce; }
    };
    await getIceServers(reqIce as Request, resIce as Response);
    assert(Array.isArray(iceResult?.iceServers), 'WebRTC ICE servers returned as valid array');
    assert(iceResult?.iceServers.some((s: any) => JSON.stringify(s.urls).includes('stun.l.google.com')), 'Google STUN servers configured for NAT traversal');

    // Test Directory
    const reqDir: any = { query: {}, user: { id: 'user-caller-101' } };
    let dirResult: any = null;
    const resDir: any = {
      status: () => resDir,
      json: (d: any) => { dirResult = d; return resDir; }
    };
    await getVoipDirectory(reqDir as Request, resDir as Response);
    assert(Array.isArray(dirResult), 'Directory endpoint returns list of active extensions');

    // Test Extension Lookup
    const reqLookup: any = { params: { extension: '1002' }, user: { id: 'user-caller-101' } };
    let lookupResult: any = null;
    const resLookup: any = {
      status: () => resLookup,
      json: (d: any) => { lookupResult = d; return resLookup; }
    };
    await lookupExtension(reqLookup as Request, resLookup as Response);
    assert(lookupResult?.extension === '1002', 'lookupExtension successfully resolves extension 1002');
    assert(lookupResult?.name.includes('Ngozi') || lookupResult?.name.includes('Test'), 'lookupExtension resolves staff name');

    // 3. Socket Signaling Integration Tests
    console.log('\n--- TEST SUITE 2: Live VoIP Audio Signaling Lifecycle ---');

    const socketCaller: ClientSocket = ioClient(`http://localhost:${PORT}`, {
      auth: { token: 'token-caller' },
      transports: ['websocket']
    });

    const socketCallee: ClientSocket = ioClient(`http://localhost:${PORT}`, {
      auth: { token: 'token-callee' },
      transports: ['websocket']
    });

    await Promise.all([
      new Promise<void>((resolve) => socketCaller.on('connect', resolve)),
      new Promise<void>((resolve) => socketCallee.on('connect', resolve))
    ]);
    assert(socketCaller.connected && socketCallee.connected, 'Both Caller and Callee client sockets connected');

    // Register extensions
    socketCaller.emit('VOIP_REGISTER_EXTENSION', { extension: '1001' });
    socketCallee.emit('VOIP_REGISTER_EXTENSION', { extension: '1002' });

    await new Promise((r) => setTimeout(r, 150));

    // Verify online extensions query
    let onlineList: string[] = [];
    await new Promise<void>((resolve) => {
      socketCaller.emit('VOIP_GET_ONLINE_EXTENSIONS', (exts: string[]) => {
        onlineList = exts;
        resolve();
      });
    });
    assert(onlineList.includes('1001') && onlineList.includes('1002'), 'Online extensions presence list detects both active peers');

    // Test Call Initiation & Incoming Call Dispatch
    const dummySdpOffer = { type: 'offer', sdp: 'v=0\r\no=test 123 456 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\n' };
    const dummySdpAnswer = { type: 'answer', sdp: 'v=0\r\no=test 789 101 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\n' };
    const dummyIceCandidate = { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host', sdpMid: 'audio', sdpMLineIndex: 0 };

    const testCallId = `call_test_${Date.now()}`;

    const incomingCallPromise = new Promise<any>((resolve) => {
      socketCallee.on('INCOMING_CALL', (payload: any) => {
        resolve(payload);
      });
    });

    socketCaller.emit('CALL_INITIATE', {
      callId: testCallId,
      targetExtension: '1002',
      sdpOffer: dummySdpOffer,
      callerName: 'Prof. Adamu Garba'
    });

    const incomingData = await incomingCallPromise;
    assert(incomingData?.callId === testCallId, 'Callee received INCOMING_CALL with correct callId');
    assert(incomingData?.callerExtension === '1001', 'Callee received INCOMING_CALL with caller extension 1001');
    assert(incomingData?.sdpOffer?.type === 'offer', 'Callee received SDP Offer from Caller');

    // Callee accepts call
    const callAcceptedPromise = new Promise<any>((resolve) => {
      socketCaller.on('CALL_ACCEPTED', (payload: any) => {
        resolve(payload);
      });
    });

    socketCallee.emit('CALL_ACCEPTED', {
      callId: testCallId,
      sdpAnswer: dummySdpAnswer
    });

    const acceptedData = await callAcceptedPromise;
    assert(acceptedData?.callId === testCallId, 'Caller received CALL_ACCEPTED acknowledgment');
    assert(acceptedData?.sdpAnswer?.type === 'answer', 'Caller received SDP Answer from Callee');

    // Peer ICE candidate exchange
    const iceCandidatePromise = new Promise<any>((resolve) => {
      socketCallee.on('ICE_CANDIDATE', (payload: any) => {
        resolve(payload);
      });
    });

    socketCaller.emit('ICE_CANDIDATE', {
      callId: testCallId,
      targetExtension: '1002',
      candidate: dummyIceCandidate
    });

    const candidateData = await iceCandidatePromise;
    assert(candidateData?.candidate?.candidate?.includes('candidate:1'), 'Callee received relayed ICE candidate from Caller');

    // Hangup / End call
    const callEndedPromise = new Promise<any>((resolve) => {
      socketCallee.on('CALL_ENDED', (payload: any) => {
        resolve(payload);
      });
    });

    socketCaller.emit('CALL_ENDED', { callId: testCallId });
    const endedData = await callEndedPromise;
    assert(endedData?.callId === testCallId, 'Callee received CALL_ENDED event upon Caller hang-up');

    // 4. Video Conference Signaling Tests
    console.log('\n--- TEST SUITE 3: Real-Time Video Conference Signaling ---');

    const videoRoom = 'research-faculty-sync-2026';
    const videoIncomingPromise = new Promise<any>((resolve) => {
      socketCallee.on('VIDEO_CALL_INCOMING', (payload: any) => {
        resolve(payload);
      });
    });

    socketCaller.emit('VIDEO_CALL_INITIATE', {
      roomName: videoRoom,
      title: 'Faculty Joint Research Review',
      callerName: 'Prof. Adamu Garba',
      callerRole: 'Professor',
      targetUserIds: ['user-callee-102']
    });

    const videoAlert = await videoIncomingPromise;
    assert(videoAlert?.roomName === videoRoom, 'Callee received VIDEO_CALL_INCOMING with roomName');
    assert(videoAlert?.title === 'Faculty Joint Research Review', 'Callee received correct video meeting title');
    assert(videoAlert?.callerName === 'Prof. Adamu Garba', 'Callee received caller display name');

    // Video accepted relay
    const videoAcceptedPromise = new Promise<any>((resolve) => {
      socketCaller.on('VIDEO_CALL_PEER_ACCEPTED', (payload: any) => {
        resolve(payload);
      });
    });

    socketCallee.emit('VIDEO_CALL_ACCEPTED', { roomName: videoRoom });
    const videoAcceptPayload = await videoAcceptedPromise;
    assert(videoAcceptPayload?.roomName === videoRoom, 'Caller received VIDEO_CALL_PEER_ACCEPTED notification');

    // Video ended relay
    const videoEndedPromise = new Promise<any>((resolve) => {
      socketCallee.on('VIDEO_CALL_ENDED', (payload: any) => {
        resolve(payload);
      });
    });

    socketCaller.emit('VIDEO_CALL_ENDED', { roomName: videoRoom });
    const videoEndPayload = await videoEndedPromise;
    assert(videoEndPayload?.roomName === videoRoom, 'Callee received VIDEO_CALL_ENDED event');

    // Disconnect clients & cleanup
    socketCaller.disconnect();
    socketCallee.disconnect();

  } catch (err: any) {
    console.error('❌ Error during E2E verification:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log(`\n======================================================`);
  console.log(`📊 E2E VoIP & Video Call Verification: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runVoipVideoE2ETests();
