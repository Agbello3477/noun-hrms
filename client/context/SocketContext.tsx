'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import api, { getSocketUrl } from '../lib/api';
import { IncomingVideoCallData } from '../components/ui/IncomingVideoCallModal';

export interface MissedCallData {
  callId: string;
  callerExtension: string;
  callerName: string;
  callerRank: string;
  missedAt: string;
}

export interface VoicemailNotificationData {
  id: string;
  callerUserId: string;
  callerExtension: string;
  recipientExtension: string;
  audioUrl: string;
  durationSeconds: number;
  isListened: boolean;
  createdAt: string;
  callerUser?: any;
}

export interface IncomingVoipCallData {
  callId: string;
  callerExtension: string;
  callerName: string;
  callerRank: string;
  sdpOffer: any;
}

export interface ActiveConferenceParticipant {
  userId: string;
  userName: string;
  userRole?: string;
  avatarUrl?: string;
}

export interface ActiveConferenceRoomData {
  roomId: string;
  callSessionId?: string;
  title: string;
  callType?: string;
  hostId: string;
  hostName: string;
  hostAvatar?: string | null;
  activeCount: number;
  activeParticipants: ActiveConferenceParticipant[];
  startedAt: number;
  durationSeconds?: number;
}

export interface MissedMeetingData {
  roomId: string;
  roomTitle: string;
  hostName: string;
  durationFormatted: string;
  attendeeNames: string[];
  missedAt: string;
}

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  userExtension: string;
  onlineExtensions: Set<string>;
  incomingVideoCall: IncomingVideoCallData | null;
  incomingVoipCall: IncomingVoipCallData | null;
  acceptedVoipCall: IncomingVoipCallData | null;
  activeVideoModal: { isOpen: boolean; roomName: string; title: string; isLateJoin?: boolean } | null;
  isVoipDialerOpen: boolean;
  initialDialerExtension: string;
  missedCalls: MissedCallData[];
  newMissedCount: number;
  latestVoicemail: VoicemailNotificationData | null;
  activeConferenceRooms: ActiveConferenceRoomData[];
  missedMeetingNotifications: MissedMeetingData[];
  liveMeetingAuditToast: MissedMeetingData | null;
  registerExtension: (ext: string) => void;
  openVoipDialer: (ext?: string) => void;
  closeVoipDialer: () => void;
  acceptVoipCall: (callData: IncomingVoipCallData) => void;
  declineVoipCall: (callData: IncomingVoipCallData) => void;
  clearAcceptedVoipCall: () => void;
  acceptVideoCall: (callData: IncomingVideoCallData) => void;
  declineVideoCall: (callData: IncomingVideoCallData) => void;
  closeActiveVideoModal: () => void;
  startVideoCall: (params: {
    roomName: string;
    title?: string;
    targetUserIds?: string[];
    module?: string;
    targetId?: string;
    callType?: string;
  }) => void;
  joinActiveCallRoom: (roomId: string, title?: string) => void;
  dismissMissedMeetingToast: () => void;
  clearNewMissedCount: () => void;
  registerActiveVoipPeer: (peer: any, callId: string) => void;
  unregisterActiveVoipPeer: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userExtension, setUserExtension] = useState<string>('');
  const [onlineExtensions, setOnlineExtensions] = useState<Set<string>>(new Set());
  
  // Incoming & Accepted Call states
  const [incomingVideoCall, setIncomingVideoCall] = useState<IncomingVideoCallData | null>(null);
  const [incomingVoipCall, setIncomingVoipCall] = useState<IncomingVoipCallData | null>(null);
  const [acceptedVoipCall, setAcceptedVoipCall] = useState<IncomingVoipCallData | null>(null);
  
  // Active Modals & Video Conferencing
  const [activeVideoModal, setActiveVideoModal] = useState<{
    isOpen: boolean;
    roomName: string;
    title: string;
    isLateJoin?: boolean;
  } | null>(null);
  const [isVoipDialerOpen, setIsVoipDialerOpen] = useState(false);
  const [initialDialerExtension, setInitialDialerExtension] = useState('');

  // Enterprise Multi-Party Video & Late-Join HUD State
  const [activeConferenceRooms, setActiveConferenceRooms] = useState<ActiveConferenceRoomData[]>([]);
  const [missedMeetingNotifications, setMissedMeetingNotifications] = useState<MissedMeetingData[]>([]);
  const [liveMeetingAuditToast, setLiveMeetingAuditToast] = useState<MissedMeetingData | null>(null);

  // Notifications
  const [missedCalls, setMissedCalls] = useState<MissedCallData[]>([]);
  const [newMissedCount, setNewMissedCount] = useState<number>(0);
  const [latestVoicemail, setLatestVoicemail] = useState<VoicemailNotificationData | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const myExtRef = useRef<string>('');
  const activePeerManagerRef = useRef<{ peer: any; callId: string } | null>(null);
  const queuedIceCandidatesRef = useRef<Map<string, any[]>>(new Map());

  // Fetch guaranteed VoIP extension for authenticated user
  const fetchExtension = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/api/voip/my-extension');
      if (data?.extension) {
        myExtRef.current = data.extension;
        setUserExtension(data.extension);
        if (socketRef.current?.connected) {
          socketRef.current.emit('VOIP_REGISTER_EXTENSION', { extension: data.extension });
        }
      }
    } catch (err) {
      console.warn('[SocketContext] Could not load user extension:', err);
    }
  }, [user]);

  // Fetch initial active rooms on mount
  const fetchInitialActiveRooms = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/api/voip/active-rooms');
      if (data?.rooms && Array.isArray(data.rooms)) {
        setActiveConferenceRooms(data.rooms);
      }
    } catch (err) {
      console.warn('[SocketContext] Could not load initial active conference rooms:', err);
    }
  }, [user]);

  // Establish persistent singleton Socket connection
  useEffect(() => {
    if (!user || typeof window === 'undefined') {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const token = sessionStorage.getItem('token');
    const socketUrl = getSocketUrl();

    if (socketRef.current?.connected) {
      return;
    }

    console.log('[SocketContext] Establishing persistent singleton connection to:', socketUrl);

    const instance = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    socketRef.current = instance;
    setSocket(instance);

    instance.on('connect', () => {
      console.log('[SocketContext] Socket connected successfully. Socket ID:', instance.id);
      setIsConnected(true);

      if (myExtRef.current) {
        instance.emit('VOIP_REGISTER_EXTENSION', { extension: myExtRef.current });
      }

      instance.emit('VOIP_GET_ONLINE_EXTENSIONS', (exts: string[]) => {
        if (Array.isArray(exts)) {
          setOnlineExtensions(new Set(exts));
        }
      });

      instance.emit('GET_ACTIVE_ROOMS', (rooms: ActiveConferenceRoomData[]) => {
        if (Array.isArray(rooms)) {
          setActiveConferenceRooms(rooms);
        }
      });
    });

    instance.on('disconnect', () => {
      console.log('[SocketContext] Socket disconnected');
      setIsConnected(false);
    });

    // ─── Real-Time Video Conference Signaling & Dynamic Late-Join ───────────
    instance.on('VIDEO_CALL_INCOMING', (callData: IncomingVideoCallData) => {
      console.log('[SocketContext] Received incoming video call alert:', callData);
      if (callData.callerUserId !== user.id) {
        setIncomingVideoCall(callData);
      }
    });

    instance.on('VIDEO_CALL_ENDED', (data: { roomName: string }) => {
      setIncomingVideoCall((prev) => (prev?.roomName === data?.roomName ? null : prev));
    });

    // Persistent "Call in Progress" Broadcast Event
    instance.on('ROOM_CALL_IN_PROGRESS', (roomData: ActiveConferenceRoomData) => {
      console.log('[SocketContext] Received ROOM_CALL_IN_PROGRESS update:', roomData);
      setActiveConferenceRooms((prev) => {
        const filtered = prev.filter((r) => r.roomId !== roomData.roomId);
        if (roomData.activeCount > 0) {
          return [roomData, ...filtered];
        }
        return filtered;
      });
    });

    // Room Ended Broadcast Event
    instance.on('ROOM_CALL_ENDED', (data: { roomId: string; durationFormatted?: string; attendeeNames?: string[] }) => {
      console.log('[SocketContext] Received ROOM_CALL_ENDED event:', data);
      setActiveConferenceRooms((prev) => prev.filter((r) => r.roomId !== data.roomId));
      setIncomingVideoCall((prev) => (prev?.roomName === data?.roomId ? null : prev));
    });

    // Post-Call Missed Session Audit Notification
    instance.on('CALL_MISSED_SUMMARY', (missedData: MissedMeetingData) => {
      console.log('[SocketContext] Received post-call missed meeting summary:', missedData);
      setMissedMeetingNotifications((prev) => [missedData, ...prev]);
      setLiveMeetingAuditToast(missedData);
      setNewMissedCount((prev) => prev + 1);
    });

    // ─── Real-Time VoIP 1-to-1 Voice Call Signaling ──────────────────────────
    instance.on('INCOMING_CALL', (data: IncomingVoipCallData) => {
      console.log('[SocketContext] Received incoming VoIP call alert:', data);
      setIncomingVoipCall(data);
    });

    instance.on('CALL_ENDED', () => {
      setIncomingVoipCall(null);
    });

    instance.on('CALL_REJECTED', () => {
      setIncomingVoipCall(null);
    });

    instance.on('CALL_TIMEOUT', () => {
      setIncomingVoipCall(null);
    });

    // Global ICE Candidate Relay Listener
    instance.on('ICE_CANDIDATE', (data: { candidate: any; callId?: string }) => {
      if (data?.candidate) {
        if (activePeerManagerRef.current && (!data.callId || activePeerManagerRef.current.callId === data.callId)) {
          activePeerManagerRef.current.peer.addIceCandidate(data.candidate);
        } else {
          const cid = data.callId || 'default';
          const list = queuedIceCandidatesRef.current.get(cid) || [];
          list.push(data.candidate);
          queuedIceCandidatesRef.current.set(cid, list);
        }
      }
    });

    // Real-time VoIP Missed Call & Voicemail
    instance.on('CALL_MISSED', (data: MissedCallData) => {
      console.log('[SocketContext] Received missed call alert:', data);
      setMissedCalls((prev) => [data, ...prev]);
      setNewMissedCount((prev) => prev + 1);
    });

    instance.on('VOICEMAIL_RECEIVED', (vm: VoicemailNotificationData) => {
      console.log('[SocketContext] Received new voicemail in real-time:', vm);
      setLatestVoicemail(vm);
      setNewMissedCount((prev) => prev + 1);
    });

    fetchExtension();
    fetchInitialActiveRooms();

    return () => {
      // Keep socket alive across Next.js route transitions
    };
  }, [user, fetchExtension, fetchInitialActiveRooms]);

  const registerExtension = useCallback((ext: string) => {
    myExtRef.current = ext;
    setUserExtension(ext);
    if (socketRef.current?.connected) {
      socketRef.current.emit('VOIP_REGISTER_EXTENSION', { extension: ext });
    }
  }, []);

  const openVoipDialer = useCallback((ext?: string) => {
    if (ext) setInitialDialerExtension(ext);
    setIsVoipDialerOpen(true);
  }, []);

  const closeVoipDialer = useCallback(() => {
    setIsVoipDialerOpen(false);
    setInitialDialerExtension('');
  }, []);

  const acceptVoipCall = useCallback((callData: IncomingVoipCallData) => {
    setAcceptedVoipCall(callData);
    setIncomingVoipCall(null);
    setIsVoipDialerOpen(true);
  }, []);

  const clearAcceptedVoipCall = useCallback(() => {
    setAcceptedVoipCall(null);
  }, []);

  const declineVoipCall = useCallback((callData: IncomingVoipCallData) => {
    if (socketRef.current) {
      socketRef.current.emit('CALL_REJECTED', {
        callId: callData.callId,
        reason: 'Call declined by user'
      });
    }
    setIncomingVoipCall(null);
    setAcceptedVoipCall(null);
  }, []);

  const acceptVideoCall = useCallback((callData: IncomingVideoCallData) => {
    if (socketRef.current) {
      socketRef.current.emit('VIDEO_CALL_ACCEPTED', { roomName: callData.roomName });
      socketRef.current.emit('JOIN_ACTIVE_ROOM', { roomId: callData.roomName });
    }
    setIncomingVideoCall(null);
    setActiveVideoModal({
      isOpen: true,
      roomName: callData.roomName,
      title: callData.title || `Video Call with ${callData.callerName}`
    });
  }, []);

  const declineVideoCall = useCallback((callData: IncomingVideoCallData) => {
    if (socketRef.current) {
      socketRef.current.emit('VIDEO_CALL_DECLINED', {
        roomName: callData.roomName,
        callerUserId: callData.callerUserId,
        title: callData.title
      });
    }
    setIncomingVideoCall(null);
  }, []);

  const closeActiveVideoModal = useCallback(() => {
    if (activeVideoModal && socketRef.current) {
      socketRef.current.emit('LEAVE_ACTIVE_ROOM', { roomId: activeVideoModal.roomName });
      socketRef.current.emit('VIDEO_CALL_ENDED', { roomName: activeVideoModal.roomName });
    }
    setActiveVideoModal(null);
  }, [activeVideoModal]);

  const startVideoCall = useCallback((params: {
    roomName: string;
    title?: string;
    targetUserIds?: string[];
    module?: string;
    targetId?: string;
    callType?: string;
  }) => {
    if (!socketRef.current || !user) return;
    const title = params.title || 'Video Collaboration Call';
    socketRef.current.emit('VIDEO_CALL_INITIATE', {
      roomName: params.roomName,
      title,
      callType: params.callType || (params.targetUserIds && params.targetUserIds.length > 1 ? 'GROUP_DEPARTMENT' : 'ONE_TO_ONE'),
      callerName: user.name || (user.email ? user.email.split('@')[0] : 'Colleague'),
      callerRole: user.role || 'Staff',
      callerAvatar: (user as any).staffProfile?.passportUrl || null,
      targetUserIds: params.targetUserIds || [],
      module: params.module || 'research',
      targetId: params.targetId || null
    });
    setActiveVideoModal({
      isOpen: true,
      roomName: params.roomName,
      title
    });
  }, [user]);

  // Join an existing active conference room in-progress (Late-Join)
  const joinActiveCallRoom = useCallback((roomId: string, title?: string) => {
    if (!socketRef.current || !user) return;
    socketRef.current.emit('JOIN_ACTIVE_ROOM', { roomId });
    setActiveVideoModal({
      isOpen: true,
      roomName: roomId,
      title: title || 'Live Video Conference Meeting',
      isLateJoin: true
    });
  }, [user]);

  const dismissMissedMeetingToast = useCallback(() => {
    setLiveMeetingAuditToast(null);
  }, []);

  const clearNewMissedCount = useCallback(() => {
    setNewMissedCount(0);
  }, []);

  const registerActiveVoipPeer = useCallback((peer: any, callId: string) => {
    console.log('[SocketContext] Registering active VoIP peer for callId:', callId);
    activePeerManagerRef.current = { peer, callId };

    const candidates = [
      ...(queuedIceCandidatesRef.current.get(callId) || []),
      ...(queuedIceCandidatesRef.current.get('default') || [])
    ];
    queuedIceCandidatesRef.current.delete(callId);
    queuedIceCandidatesRef.current.delete('default');

    if (candidates.length > 0) {
      console.log(`[SocketContext] Flushing ${candidates.length} early buffered ICE candidates to active peer`);
      candidates.forEach((candidate) => {
        peer.addIceCandidate(candidate);
      });
    }
  }, []);

  const unregisterActiveVoipPeer = useCallback(() => {
    console.log('[SocketContext] Unregistering active VoIP peer');
    activePeerManagerRef.current = null;
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        userExtension,
        onlineExtensions,
        incomingVideoCall,
        incomingVoipCall,
        acceptedVoipCall,
        activeVideoModal,
        isVoipDialerOpen,
        initialDialerExtension,
        missedCalls,
        newMissedCount,
        latestVoicemail,
        activeConferenceRooms,
        missedMeetingNotifications,
        liveMeetingAuditToast,
        registerExtension,
        openVoipDialer,
        closeVoipDialer,
        acceptVoipCall,
        declineVoipCall,
        clearAcceptedVoipCall,
        acceptVideoCall,
        declineVideoCall,
        closeActiveVideoModal,
        startVideoCall,
        joinActiveCallRoom,
        dismissMissedMeetingToast,
        clearNewMissedCount,
        registerActiveVoipPeer,
        unregisterActiveVoipPeer
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextValue => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
