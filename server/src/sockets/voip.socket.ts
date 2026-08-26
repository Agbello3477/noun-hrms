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
  io.on('connection', async (socket: Socket) => {
    const user = (socket as any).user;
    if (!user) return;

    // Join user's personal signaling room
    socket.join(`voip_user_${user.id}`);

    // Automatically lookup and register user's VoIP extension on socket connection
    try {
      const staff = await prisma.staffProfile.findUnique({
        where: { userId: user.id },
        select: { voipExtension: true }
      });
      if (staff?.voipExtension) {
        socket.join(`voip_ext_${staff.voipExtension}`);
        console.log(`[VoIP Socket] Automatically registered user ${user.id} to extension ${staff.voipExtension}`);
        io.emit('VOIP_EXTENSION_STATUS_CHANGED', { extension: staff.voipExtension, isOnline: true });
      }
    } catch (err) {
      console.error('[VoIP Socket] Error auto-registering extension:', err);
    }

    // Register 4-digit VoIP Extension (explicit client fallback)
    socket.on('VOIP_REGISTER_EXTENSION', async (data: { extension: string }) => {
      const ext = data?.extension;
      if (ext) {
        socket.join(`voip_ext_${ext}`);
        console.log(`[VoIP Socket] User ${user.id} (${user.name}) registered extension ${ext} on socket ${socket.id}`);
        io.emit('VOIP_EXTENSION_STATUS_CHANGED', { extension: ext, isOnline: true });
      }
    });

    // Check which extensions are currently online in real-time
    socket.on('VOIP_GET_ONLINE_EXTENSIONS', (callback: (onlineExtensions: string[]) => void) => {
      if (typeof callback !== 'function') return;
      const onlineExts: string[] = [];
      const rooms = io.sockets.adapter.rooms;
      for (const [roomName, roomSet] of rooms.entries()) {
        if (roomName.startsWith('voip_ext_') && roomSet.size > 0) {
          onlineExts.push(roomName.replace('voip_ext_', ''));
        }
      }
      callback(onlineExts);
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
          reason: 'OFFLINE',
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

    // ─── Real-Time WhatsApp-Style Video Conference Signaling ───────────────────
    socket.on('VIDEO_CALL_INITIATE', (payload: {
      roomName: string;
      title?: string;
      callerName?: string;
      callerRole?: string;
      callerAvatar?: string;
      targetUserIds?: string[];
      module?: string;
      targetId?: string;
    }) => {
      const { roomName, title, callerName, callerRole, callerAvatar, targetUserIds, module, targetId } = payload;
      const callerInfo = {
        callerUserId: user.id,
        callerName: callerName || user.name || 'Staff Colleague',
        callerRole: callerRole || user.role || 'Academic Staff',
        callerAvatar: callerAvatar || null,
        roomName,
        title: title || 'Video Conference Meeting',
        module: module || 'research',
        targetId: targetId || null,
        timestamp: new Date().toISOString()
      };

      console.log(`[Video Call Signaling] ${callerInfo.callerName} initiated video call in room ${roomName}`);

      if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
        // Send directly to targeted peer users (excluding caller)
        targetUserIds.forEach((targetUid) => {
          if (targetUid !== user.id) {
            io.to(`voip_user_${targetUid}`).emit('VIDEO_CALL_INCOMING', callerInfo);
          }
        });
      } else {
        // Broadcast to all connected clients except initiator
        socket.broadcast.emit('VIDEO_CALL_INCOMING', callerInfo);
      }
    });

    socket.on('VIDEO_CALL_ACCEPTED', (data: { roomName: string }) => {
      console.log(`[Video Call Signaling] User ${user.id} (${user.name}) accepted video call in room ${data?.roomName}`);
      socket.broadcast.emit('VIDEO_CALL_PEER_ACCEPTED', {
        roomName: data?.roomName,
        userId: user.id,
        userName: user.name || 'Peer Colleague'
      });
    });

    socket.on('VIDEO_CALL_DECLINED', (data: { roomName: string; callerUserId?: string }) => {
      console.log(`[Video Call Signaling] User ${user.id} (${user.name}) declined video call in room ${data?.roomName}`);
      if (data?.callerUserId) {
        io.to(`voip_user_${data.callerUserId}`).emit('VIDEO_CALL_PEER_DECLINED', {
          roomName: data.roomName,
          userId: user.id,
          userName: user.name || 'Peer Colleague'
        });
      }
    });

    socket.on('VIDEO_CALL_ENDED', (data: { roomName: string }) => {
      console.log(`[Video Call Signaling] Video call ended in room ${data?.roomName}`);
      socket.broadcast.emit('VIDEO_CALL_ENDED', {
        roomName: data?.roomName,
        userId: user.id
      });
    });

    // ─── Real-Time Voicemail Notification Relay ─────────────────────────────────
    socket.on('VOICEMAIL_SENT', (data: {
      recipientUserId: string;
      recipientExtension: string;
      voicemail: any;
    }) => {
      if (data?.recipientUserId) {
        io.to(`voip_user_${data.recipientUserId}`).emit('VOICEMAIL_RECEIVED', data.voicemail);
      }
      if (data?.recipientExtension) {
        io.to(`voip_ext_${data.recipientExtension}`).emit('VOICEMAIL_RECEIVED', data.voicemail);
      }
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
