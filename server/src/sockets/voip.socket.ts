import { Server as SocketIOServer, Socket } from 'socket.io';
import prisma from '../prisma';
import conferenceRoomManager, { ConferenceParticipant } from '../services/conferenceRoomManager';

interface ActiveCallSession {
  callId: string;
  callerUserId: string;
  callerExtension: string;
  targetExtension: string;
  targetUserId?: string;
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
      callId?: string;
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

      // Target socket room check (check both extension room and user room)
      const calleeProfile = await prisma.staffProfile.findFirst({
        where: { voipExtension: targetExtension, isDeleted: false },
        select: { userId: true, surname: true, otherNames: true, rank: true }
      });

      const targetExtRoom = io.sockets.adapter.rooms.get(`voip_ext_${targetExtension}`);
      const targetUserRoom = calleeProfile?.userId ? io.sockets.adapter.rooms.get(`voip_user_${calleeProfile.userId}`) : null;
      const isOnline = (targetExtRoom && targetExtRoom.size > 0) || (targetUserRoom && targetUserRoom.size > 0);

      if (!isOnline) {
        return socket.emit('CALL_UNAVAILABLE', {
          targetExtension,
          reason: 'OFFLINE',
          message: `Extension ${targetExtension} is currently offline.`
        });
      }

      const callId = payload.callId || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Create active call record
      const callSession: ActiveCallSession = {
        callId,
        callerUserId: user.id,
        callerExtension: callerExt,
        targetExtension,
        targetUserId: calleeProfile?.userId,
        startTime: Date.now(),
        status: 'INITIATED'
      };

      // Set 25-second timeout for unanswered call
      callSession.timer = setTimeout(async () => {
        const session = activeCalls.get(callId);
        if (session && session.status === 'INITIATED') {
          session.status = 'ENDED';
          io.to(`voip_user_${user.id}`).emit('CALL_TIMEOUT', { callId, message: 'No answer from target extension.' });
          
          const missedPayload = {
            callId,
            callerExtension: callerExt,
            callerName: displayName,
            callerRank: callerRank || callerProfile?.rank || 'Staff',
            missedAt: new Date().toISOString()
          };

          io.to(`voip_ext_${targetExtension}`).emit('CALL_MISSED', missedPayload);
          if (calleeProfile?.userId) {
            io.to(`voip_user_${calleeProfile.userId}`).emit('CALL_MISSED', missedPayload);
            try {
              await prisma.notification.create({
                data: {
                  userId: calleeProfile.userId,
                  title: '📞 Missed VoIP Call',
                  message: `Missed call from ${displayName} (Ext: ${callerExt})`,
                  type: 'WARNING',
                  link: '/dashboard'
                }
              });
            } catch (err) {}
          }

          activeCalls.delete(callId);
          userActiveCall.delete(user.id);
        }
      }, 25000);

      activeCalls.set(callId, callSession);
      userActiveCall.set(user.id, callId);

      const incomingPayload = {
        callId,
        callerExtension: callerExt,
        callerName: displayName,
        callerRank: callerRank || callerProfile?.rank || 'Staff',
        callerUserId: user.id,
        sdpOffer
      };

      // Notify target client(s) in both extension and user rooms
      io.to(`voip_ext_${targetExtension}`).emit('INCOMING_CALL', incomingPayload);
      if (calleeProfile?.userId) {
        io.to(`voip_user_${calleeProfile.userId}`).emit('INCOMING_CALL', incomingPayload);
      }

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

        const payload = {
          callId: data.callId,
          sdpAnswer: data.sdpAnswer
        };

        io.to(`voip_user_${session.callerUserId}`).emit('CALL_ACCEPTED', payload);
        if (session.callerExtension) {
          io.to(`voip_ext_${session.callerExtension}`).emit('CALL_ACCEPTED', payload);
        }
      }
    });

    // Reject Call
    socket.on('CALL_REJECTED', (data: { callId: string; reason?: string }) => {
      const session = activeCalls.get(data.callId);
      if (session) {
        if (session.timer) clearTimeout(session.timer);
        session.status = 'ENDED';

        const payload = {
          callId: data.callId,
          reason: data.reason || 'Call was declined by recipient'
        };

        io.to(`voip_user_${session.callerUserId}`).emit('CALL_REJECTED', payload);
        if (session.callerExtension) {
          io.to(`voip_ext_${session.callerExtension}`).emit('CALL_REJECTED', payload);
        }

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

        const payload = { callId: data.callId };
        io.to(`voip_user_${session.callerUserId}`).emit('CALL_ENDED', payload);
        io.to(`voip_ext_${session.targetExtension}`).emit('CALL_ENDED', payload);
        if (session.callerExtension) {
          io.to(`voip_ext_${session.callerExtension}`).emit('CALL_ENDED', payload);
        }
        if (session.targetUserId) {
          io.to(`voip_user_${session.targetUserId}`).emit('CALL_ENDED', payload);
        }

        activeCalls.delete(data.callId);
        userActiveCall.delete(session.callerUserId);
        userActiveCall.delete(user.id);
      }
    });

    // Relay WebRTC ICE Candidate
    socket.on('ICE_CANDIDATE', (data: { targetExtension?: string; targetUserId?: string; candidate: any; callId: string }) => {
      const session = activeCalls.get(data.callId);
      const candidatePayload = {
        callerUserId: user.id,
        candidate: data.candidate,
        callId: data.callId
      };

      if (session) {
        if (user.id === session.callerUserId) {
          // Caller -> Callee: emit to both extension room and user room
          io.to(`voip_ext_${session.targetExtension}`).emit('ICE_CANDIDATE', candidatePayload);
          if (session.targetUserId) {
            io.to(`voip_user_${session.targetUserId}`).emit('ICE_CANDIDATE', candidatePayload);
          }
        } else {
          // Callee -> Caller: emit to caller's user room and caller's extension room
          io.to(`voip_user_${session.callerUserId}`).emit('ICE_CANDIDATE', candidatePayload);
          if (session.callerExtension) {
            io.to(`voip_ext_${session.callerExtension}`).emit('ICE_CANDIDATE', candidatePayload);
          }
        }
      } else {
        if (data.targetExtension) {
          io.to(`voip_ext_${data.targetExtension}`).emit('ICE_CANDIDATE', candidatePayload);
        }
        if (data.targetUserId) {
          io.to(`voip_user_${data.targetUserId}`).emit('ICE_CANDIDATE', candidatePayload);
        }
      }
    });

    // ─── Real-Time Enterprise Multi-Party Video Conference Signaling ─────────
    socket.on('GET_ACTIVE_ROOMS', (callback: (rooms: any[]) => void) => {
      if (typeof callback === 'function') {
        callback(conferenceRoomManager.getActiveRooms());
      }
    });

    socket.on('VIDEO_CALL_INITIATE', async (payload: {
      roomName: string;
      title?: string;
      callType?: string;
      callerName?: string;
      callerRole?: string;
      callerAvatar?: string;
      targetUserIds?: string[];
      module?: string;
      targetId?: string;
    }) => {
      const { roomName, title, callType, callerName, callerRole, callerAvatar, targetUserIds = [], module, targetId } = payload;
      const roomId = roomName;

      // Create or get room in conferenceRoomManager
      const room = await conferenceRoomManager.createOrGetRoom({
        roomId,
        title: title || 'Video Conference Meeting',
        callType: callType || (targetUserIds.length > 1 ? 'GROUP_DEPARTMENT' : 'ONE_TO_ONE'),
        hostUser: {
          id: user.id,
          name: callerName || user.name || 'Staff Colleague',
          role: callerRole || user.role || 'Staff',
          avatarUrl: callerAvatar || undefined
        },
        targetUserIds
      });

      // Host joins socket room
      socket.join(`video_room_${roomId}`);
      await conferenceRoomManager.joinRoom(roomId, {
        id: user.id,
        name: callerName || user.name || 'Staff Colleague',
        role: callerRole || user.role || 'Staff',
        avatarUrl: callerAvatar || undefined
      }, socket.id);

      const callerInfo = {
        callerUserId: user.id,
        callerName: callerName || user.name || 'Staff Colleague',
        callerRole: callerRole || user.role || 'Academic Staff',
        callerAvatar: callerAvatar || null,
        roomName: roomId,
        roomId,
        callSessionId: room.callSessionId,
        title: room.title,
        module: module || 'research',
        targetId: targetId || null,
        timestamp: new Date().toISOString()
      };

      console.log(`[Video Call Signaling] ${callerInfo.callerName} initiated video room ${roomId} (Session: ${room.callSessionId})`);

      // 1. Emit to all targeted user personal socket rooms
      if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
        targetUserIds.forEach((targetUid) => {
          if (targetUid !== user.id) {
            io.to(`voip_user_${targetUid}`).emit('VIDEO_CALL_INCOMING', callerInfo);
          }
        });
      }

      // 2. Emit to project collaborative socket room if targetId exists
      if (targetId) {
        io.to(`project_${targetId}`).emit('VIDEO_CALL_INCOMING', callerInfo);
      }

      // 3. Global broadcast to all connected dashboard peers (excluding caller)
      socket.broadcast.emit('VIDEO_CALL_INCOMING', callerInfo);

      // 4. Broadcast live "Call in Progress" HUD update to all connected users
      io.emit('ROOM_CALL_IN_PROGRESS', {
        roomId,
        callSessionId: room.callSessionId,
        title: room.title,
        hostId: user.id,
        hostName: callerInfo.callerName,
        hostAvatar: callerAvatar || null,
        activeCount: room.activeParticipants.size,
        activeParticipants: Array.from(room.activeParticipants.values()).map((p: ConferenceParticipant) => ({
          userId: p.userId,
          userName: p.userName,
          userRole: p.userRole,
          avatarUrl: p.avatarUrl
        })),
        startedAt: room.startedAt
      });
    });

    // Dynamic Late-Join: Join an active video room in-progress
    socket.on('JOIN_ACTIVE_ROOM', async (data: { roomId: string; roomName?: string }) => {
      const roomId = data.roomId || data.roomName;
      if (!roomId) return;

      socket.join(`video_room_${roomId}`);

      const { room, isLateJoin, participant } = await conferenceRoomManager.joinRoom(
        roomId,
        {
          id: user.id,
          name: user.name || 'Staff Colleague',
          role: user.role || 'Staff',
          avatarUrl: (user as any).staffProfile?.passportUrl
        },
        socket.id
      );

      console.log(`[Video Call Signaling] User ${user.id} (${user.name}) ${isLateJoin ? 'LATE-JOINED' : 'joined'} room ${roomId}`);

      // Respond to joining socket with room state & existing active peers
      socket.emit('ROOM_JOIN_SUCCESS', {
        roomId,
        callSessionId: room.callSessionId,
        title: room.title,
        hostId: room.hostId,
        hostName: room.hostName,
        participants: Array.from(room.activeParticipants.values()),
        activeCount: room.activeParticipants.size
      });

      // Notify existing peers in room that a new peer joined
      socket.to(`video_room_${roomId}`).emit('PEER_JOINED_ROOM', {
        roomId,
        participant,
        isLateJoin,
        activeCount: room.activeParticipants.size
      });

      // Broadcast updated banner HUD state to all connected dashboard clients
      io.emit('ROOM_CALL_IN_PROGRESS', {
        roomId,
        callSessionId: room.callSessionId,
        title: room.title,
        hostId: room.hostId,
        hostName: room.hostName,
        hostAvatar: room.hostAvatar,
        activeCount: room.activeParticipants.size,
        activeParticipants: Array.from(room.activeParticipants.values()).map((p: ConferenceParticipant) => ({
          userId: p.userId,
          userName: p.userName,
          userRole: p.userRole,
          avatarUrl: p.avatarUrl
        })),
        startedAt: room.startedAt
      });
    });

    // Leave active room
    socket.on('LEAVE_ACTIVE_ROOM', async (data: { roomId: string; roomName?: string }) => {
      const roomId = data.roomId || data.roomName;
      if (!roomId) return;

      socket.leave(`video_room_${roomId}`);
      const { room, wasLastParticipant, leftParticipant } = await conferenceRoomManager.leaveRoom(roomId, user.id);

      console.log(`[Video Call Signaling] User ${user.id} (${user.name}) left room ${roomId}. Remaining: ${room?.activeParticipants.size || 0}`);

      if (leftParticipant) {
        socket.to(`video_room_${roomId}`).emit('PEER_LEFT_ROOM', {
          roomId,
          userId: user.id,
          userName: user.name || 'Staff Colleague',
          activeCount: room?.activeParticipants.size || 0
        });
      }

      if (wasLastParticipant) {
        const auditResult = await conferenceRoomManager.endRoom(roomId, user.id);
        if (auditResult) {
          console.log(`[Video Call Audit] Room ${roomId} terminated. Duration: ${auditResult.durationFormatted}. Missed: ${auditResult.missedUserIds.length}`);
          
          io.emit('ROOM_CALL_ENDED', {
            roomId,
            durationFormatted: auditResult.durationFormatted,
            attendeeNames: auditResult.attendeeNames
          });

          // Dispatch real-time notification events to missed participants
          auditResult.missedUserIds.forEach((mUid: string) => {
            io.to(`voip_user_${mUid}`).emit('CALL_MISSED_SUMMARY', {
              roomId,
              roomTitle: auditResult.roomTitle,
              hostName: auditResult.hostName,
              durationFormatted: auditResult.durationFormatted,
              attendeeNames: auditResult.attendeeNames,
              missedAt: new Date().toISOString()
            });
          });
        }
      } else if (room) {
        io.emit('ROOM_CALL_IN_PROGRESS', {
          roomId,
          callSessionId: room.callSessionId,
          title: room.title,
          hostId: room.hostId,
          hostName: room.hostName,
          hostAvatar: room.hostAvatar,
          activeCount: room.activeParticipants.size,
          activeParticipants: Array.from(room.activeParticipants.values()).map((p: ConferenceParticipant) => ({
            userId: p.userId,
            userName: p.userName,
            userRole: p.userRole,
            avatarUrl: p.avatarUrl
          })),
          startedAt: room.startedAt
        });
      }
    });

    // Multi-Peer WebRTC Mesh Signaling Relays
    socket.on('ROOM_SIGNAL_OFFER', (data: {
      roomId: string;
      targetUserId: string;
      targetSocketId?: string;
      sdpOffer: any;
    }) => {
      const payload = {
        roomId: data.roomId,
        sdpOffer: data.sdpOffer,
        senderUserId: user.id,
        senderSocketId: socket.id,
        senderName: user.name || 'Staff Colleague',
        senderRole: user.role || 'Staff'
      };

      if (data.targetSocketId) {
        io.to(data.targetSocketId).emit('ROOM_SIGNAL_OFFER', payload);
      } else {
        io.to(`voip_user_${data.targetUserId}`).emit('ROOM_SIGNAL_OFFER', payload);
      }
    });

    socket.on('ROOM_SIGNAL_ANSWER', (data: {
      roomId: string;
      targetUserId: string;
      targetSocketId?: string;
      sdpAnswer: any;
    }) => {
      const payload = {
        roomId: data.roomId,
        sdpAnswer: data.sdpAnswer,
        senderUserId: user.id,
        senderSocketId: socket.id
      };

      if (data.targetSocketId) {
        io.to(data.targetSocketId).emit('ROOM_SIGNAL_ANSWER', payload);
      } else {
        io.to(`voip_user_${data.targetUserId}`).emit('ROOM_SIGNAL_ANSWER', payload);
      }
    });

    socket.on('ROOM_SIGNAL_ICE_CANDIDATE', (data: {
      roomId: string;
      targetUserId: string;
      targetSocketId?: string;
      candidate: any;
    }) => {
      const payload = {
        roomId: data.roomId,
        candidate: data.candidate,
        senderUserId: user.id,
        senderSocketId: socket.id
      };

      if (data.targetSocketId) {
        io.to(data.targetSocketId).emit('ROOM_SIGNAL_ICE_CANDIDATE', payload);
      } else {
        io.to(`voip_user_${data.targetUserId}`).emit('ROOM_SIGNAL_ICE_CANDIDATE', payload);
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

    socket.on('VIDEO_CALL_DECLINED', async (data: { roomName: string; callerUserId?: string; title?: string }) => {
      console.log(`[Video Call Signaling] User ${user.id} (${user.name}) declined video call in room ${data?.roomName}`);
      if (data?.callerUserId) {
        io.to(`voip_user_${data.callerUserId}`).emit('VIDEO_CALL_PEER_DECLINED', {
          roomName: data.roomName,
          userId: user.id,
          userName: user.name || 'Peer Colleague'
        });
      }
    });

    socket.on('VIDEO_CALL_ENDED', async (data: { roomName: string; targetUserIds?: string[]; title?: string; callerName?: string }) => {
      const roomId = data?.roomName;
      console.log(`[Video Call Signaling] Video call explicitly ended for room ${roomId} by user ${user.id}`);
      
      const auditResult = await conferenceRoomManager.endRoom(roomId, user.id);

      io.to(`video_room_${roomId}`).emit('ROOM_TERMINATED', {
        roomId,
        reason: 'Meeting ended by host',
        durationFormatted: auditResult?.durationFormatted || '0 secs',
        attendeeNames: auditResult?.attendeeNames || []
      });

      socket.broadcast.emit('VIDEO_CALL_ENDED', {
        roomName: roomId,
        userId: user.id
      });

      io.emit('ROOM_CALL_ENDED', {
        roomId,
        durationFormatted: auditResult?.durationFormatted || '0 secs',
        attendeeNames: auditResult?.attendeeNames || []
      });

      if (auditResult && auditResult.missedUserIds.length > 0) {
        auditResult.missedUserIds.forEach((mUid: string) => {
          io.to(`voip_user_${mUid}`).emit('CALL_MISSED_SUMMARY', {
            roomId,
            roomTitle: auditResult.roomTitle,
            hostName: auditResult.hostName,
            durationFormatted: auditResult.durationFormatted,
            attendeeNames: auditResult.attendeeNames,
            missedAt: new Date().toISOString()
          });
        });
      }
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

    socket.on('disconnect', async () => {
      // Clean up 1-to-1 VoIP call if active
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

      // Clean up any conference rooms user was participating in
      try {
        const leftRooms = await conferenceRoomManager.handleSocketDisconnect(socket.id, user.id);
        for (const lr of leftRooms) {
          socket.to(`video_room_${lr.roomId}`).emit('PEER_LEFT_ROOM', {
            roomId: lr.roomId,
            userId: user.id,
            userName: user.name || 'Staff Colleague',
            activeCount: lr.wasLastParticipant ? 0 : 1
          });

          if (lr.wasLastParticipant) {
            const auditResult = await conferenceRoomManager.endRoom(lr.roomId, user.id);
            if (auditResult) {
              io.emit('ROOM_CALL_ENDED', {
                roomId: lr.roomId,
                durationFormatted: auditResult.durationFormatted,
                attendeeNames: auditResult.attendeeNames
              });

              auditResult.missedUserIds.forEach((mUid: string) => {
                io.to(`voip_user_${mUid}`).emit('CALL_MISSED_SUMMARY', {
                  roomId: lr.roomId,
                  roomTitle: auditResult.roomTitle,
                  hostName: auditResult.hostName,
                  durationFormatted: auditResult.durationFormatted,
                  attendeeNames: auditResult.attendeeNames,
                  missedAt: new Date().toISOString()
                });
              });
            }
          }
        }
      } catch (discErr) {
        console.error('[VoIP Socket] Error handling conference disconnect:', discErr);
      }
    });
  });
};
