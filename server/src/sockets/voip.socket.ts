import { Server as SocketIOServer, Socket } from 'socket.io';
import prisma from '../prisma';

interface ActiveCallSession {
  callId: string;
  callerUserId: string;
  callerExtension: string;
  targetExtension: string;
  startTime: number;
  status: 'INITIATED' | 'RINGING' | 'ACCEPTED' | 'ENDED';
  timer?: NodeJS.Timeout;
}

// In-memory active call sessions (decoupled from DB transactions for maximum speed)
const activeCalls = new Map<string, ActiveCallSession>();
const userActiveCall = new Map<string, string>(); // userId -> callId

export const setupVoipSocket = (io: SocketIOServer) => {
  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    if (!user) return;

    // Join user's personal signaling room
    socket.join(`voip_user_${user.id}`);

    // Register 4-digit VoIP Extension
    socket.on('VOIP_REGISTER_EXTENSION', async (data: { extension: string }) => {
      const ext = data?.extension;
      if (ext) {
        socket.join(`voip_ext_${ext}`);
        console.log(`[VoIP Socket] User ${user.id} registered extension ${ext} on socket ${socket.id}`);
      }
    });

    // Initiate Call
    socket.on('CALL_INITIATE', async (payload: {
      targetExtension: string;
      sdpOffer: any;
      callerName?: string;
      callerRank?: string;
    }) => {
      const { targetExtension, sdpOffer, callerName, callerRank } = payload;

      if (!targetExtension) {
        return socket.emit('CALL_FAILED', { reason: 'Target extension is required' });
      }

      // Check if caller is already in an active call
      if (userActiveCall.has(user.id)) {
        return socket.emit('CALL_FAILED', { reason: 'You are already in an active call' });
      }

      // Lookup caller extension from DB
      const callerProfile = await prisma.staffProfile.findUnique({
        where: { userId: user.id },
        select: { voipExtension: true, surname: true, otherNames: true, rank: true }
      });

      const callerExt = callerProfile?.voipExtension || '1000';
      const displayName = callerName || `${callerProfile?.surname || ''} ${callerProfile?.otherNames || ''}`.trim() || user.name;

      // Target socket room check
      const targetRoom = io.sockets.adapter.rooms.get(`voip_ext_${targetExtension}`);
      if (!targetRoom || targetRoom.size === 0) {
        return socket.emit('CALL_UNAVAILABLE', {
          targetExtension,
          message: `Extension ${targetExtension} is currently offline or un-registered.`
        });
      }

      const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Create active call record
      const callSession: ActiveCallSession = {
        callId,
        callerUserId: user.id,
        callerExtension: callerExt,
        targetExtension,
        startTime: Date.now(),
        status: 'INITIATED'
      };

      // Set 10-second timeout for unanswered call
      callSession.timer = setTimeout(() => {
        const session = activeCalls.get(callId);
        if (session && session.status === 'INITIATED') {
          session.status = 'ENDED';
          // Notify caller of timeout
          io.to(`voip_user_${user.id}`).emit('CALL_TIMEOUT', { callId, message: 'No answer from target extension after 10 seconds.' });
          // Notify callee of a missed call so they can display notification
          io.to(`voip_ext_${targetExtension}`).emit('CALL_MISSED', {
            callId,
            callerExtension: callerExt,
            callerName: displayName,
            callerRank: callerRank || callerProfile?.rank || 'Staff',
            missedAt: new Date().toISOString()
          });
          activeCalls.delete(callId);
          userActiveCall.delete(user.id);
        }
      }, 10000);

      activeCalls.set(callId, callSession);
      userActiveCall.set(user.id, callId);

      // Notify target client(s) in extension room
      io.to(`voip_ext_${targetExtension}`).emit('INCOMING_CALL', {
        callId,
        callerExtension: callerExt,
        callerName: displayName,
        callerRank: callerRank || callerProfile?.rank || 'Staff',
        sdpOffer
      });

      socket.emit('CALL_INITIATED_ACK', { callId });
    });

    // Ringing Acknowledgment
    socket.on('CALL_RINGING', (data: { callId: string }) => {
      const session = activeCalls.get(data.callId);
      if (session) {
        session.status = 'RINGING';
        io.to(`voip_user_${session.callerUserId}`).emit('CALL_RINGING', { callId: data.callId });
      }
    });

    // Accept Call
    socket.on('CALL_ACCEPTED', (data: { callId: string; sdpAnswer: any }) => {
      const session = activeCalls.get(data.callId);
      if (session) {
        if (session.timer) clearTimeout(session.timer);
        session.status = 'ACCEPTED';
        userActiveCall.set(user.id, data.callId);

        io.to(`voip_user_${session.callerUserId}`).emit('CALL_ACCEPTED', {
          callId: data.callId,
          sdpAnswer: data.sdpAnswer
        });
      }
    });

    // Reject Call
    socket.on('CALL_REJECTED', (data: { callId: string; reason?: string }) => {
      const session = activeCalls.get(data.callId);
      if (session) {
        if (session.timer) clearTimeout(session.timer);
        session.status = 'ENDED';

        io.to(`voip_user_${session.callerUserId}`).emit('CALL_REJECTED', {
          callId: data.callId,
          reason: data.reason || 'Call was declined by recipient'
        });

        activeCalls.delete(data.callId);
        userActiveCall.delete(session.callerUserId);
        userActiveCall.delete(user.id);
      }
    });

    // End / Hang-up Call
    socket.on('CALL_ENDED', (data: { callId: string }) => {
      const session = activeCalls.get(data.callId);
      if (session) {
        if (session.timer) clearTimeout(session.timer);
        session.status = 'ENDED';

        io.to(`voip_user_${session.callerUserId}`).emit('CALL_ENDED', { callId: data.callId });
        io.to(`voip_ext_${session.targetExtension}`).emit('CALL_ENDED', { callId: data.callId });

        activeCalls.delete(data.callId);
        userActiveCall.delete(session.callerUserId);
        userActiveCall.delete(user.id);
      }
    });

    // Relay WebRTC ICE Candidate
    socket.on('ICE_CANDIDATE', (data: { targetExtension: string; candidate: any; callId: string }) => {
      io.to(`voip_ext_${data.targetExtension}`).emit('ICE_CANDIDATE', {
        callerUserId: user.id,
        candidate: data.candidate,
        callId: data.callId
      });
    });

    // Security Walkie-Talkie Push-to-Talk (PTT)
    socket.on('SECURITY_PTT_JOIN', () => {
      socket.join('security_ptt_channel');
    });

    socket.on('SECURITY_PTT_TALK_START', (data: { channelId?: string }) => {
      socket.to('security_ptt_channel').emit('SECURITY_PTT_TALK_START', {
        speakerUserId: user.id,
        speakerName: user.name || 'Security Officer',
        channelId: data?.channelId || 'MAIN_DISPATCH'
      });
    });

    socket.on('SECURITY_PTT_TALK_STOP', (data: { channelId?: string }) => {
      socket.to('security_ptt_channel').emit('SECURITY_PTT_TALK_STOP', {
        speakerUserId: user.id,
        channelId: data?.channelId || 'MAIN_DISPATCH'
      });
    });

    socket.on('disconnect', () => {
      const activeCallId = userActiveCall.get(user.id);
      if (activeCallId) {
        const session = activeCalls.get(activeCallId);
        if (session) {
          if (session.timer) clearTimeout(session.timer);
          io.to(`voip_user_${session.callerUserId}`).emit('CALL_ENDED', { callId: activeCallId, reason: 'Peer socket disconnected' });
          io.to(`voip_ext_${session.targetExtension}`).emit('CALL_ENDED', { callId: activeCallId, reason: 'Peer socket disconnected' });
          activeCalls.delete(activeCallId);
        }
        userActiveCall.delete(user.id);
      }
    });
  });
};
