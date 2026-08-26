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

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  userExtension: string;
  onlineExtensions: Set<string>;
  incomingVideoCall: IncomingVideoCallData | null;
  activeVideoModal: { isOpen: boolean; roomName: string; title: string } | null;
  missedCalls: MissedCallData[];
  newMissedCount: number;
  latestVoicemail: VoicemailNotificationData | null;
  registerExtension: (ext: string) => void;
  acceptVideoCall: (callData: IncomingVideoCallData) => void;
  declineVideoCall: (callData: IncomingVideoCallData) => void;
  closeActiveVideoModal: () => void;
  startVideoCall: (params: {
    roomName: string;
    title?: string;
    targetUserIds?: string[];
    module?: string;
    targetId?: string;
  }) => void;
  clearNewMissedCount: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userExtension, setUserExtension] = useState<string>('');
  const [onlineExtensions, setOnlineExtensions] = useState<Set<string>>(new Set());
  const [incomingVideoCall, setIncomingVideoCall] = useState<IncomingVideoCallData | null>(null);
  const [activeVideoModal, setActiveVideoModal] = useState<{
    isOpen: boolean;
    roomName: string;
    title: string;
  } | null>(null);
  const [missedCalls, setMissedCalls] = useState<MissedCallData[]>([]);
  const [newMissedCount, setNewMissedCount] = useState<number>(0);
  const [latestVoicemail, setLatestVoicemail] = useState<VoicemailNotificationData | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const myExtRef = useRef<string>('');

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

    const token = localStorage.getItem('token');
    const socketUrl = getSocketUrl();

    // Do not reconnect if already connected to the same socketUrl
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
    });

    instance.on('disconnect', () => {
      console.log('[SocketContext] Socket disconnected');
      setIsConnected(false);
    });

    // Real-time WhatsApp-Style Video Signaling
    instance.on('VIDEO_CALL_INCOMING', (callData: IncomingVideoCallData) => {
      console.log('[SocketContext] Received incoming video call alert:', callData);
      if (callData.callerUserId !== user.id) {
        setIncomingVideoCall(callData);
      }
    });

    instance.on('VIDEO_CALL_ENDED', (data: { roomName: string }) => {
      setIncomingVideoCall((prev) => (prev?.roomName === data?.roomName ? null : prev));
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

    return () => {
      // Keep socket alive across Next.js route transitions
    };
  }, [user, fetchExtension]);

  const registerExtension = useCallback((ext: string) => {
    myExtRef.current = ext;
    setUserExtension(ext);
    if (socketRef.current?.connected) {
      socketRef.current.emit('VOIP_REGISTER_EXTENSION', { extension: ext });
    }
  }, []);

  const acceptVideoCall = useCallback((callData: IncomingVideoCallData) => {
    if (socketRef.current) {
      socketRef.current.emit('VIDEO_CALL_ACCEPTED', { roomName: callData.roomName });
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
        callerUserId: callData.callerUserId
      });
    }
    setIncomingVideoCall(null);
  }, []);

  const closeActiveVideoModal = useCallback(() => {
    if (activeVideoModal && socketRef.current) {
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
  }) => {
    if (!socketRef.current || !user) return;
    socketRef.current.emit('VIDEO_CALL_INITIATE', {
      roomName: params.roomName,
      title: params.title || 'Video Collaboration Call',
      callerName: user.name || (user.email ? user.email.split('@')[0] : 'Colleague'),
      callerRole: user.role || 'Staff',
      callerAvatar: (user as any).staffProfile?.passportUrl || null,
      targetUserIds: params.targetUserIds || [],
      module: params.module || 'research',
      targetId: params.targetId || null
    });
  }, [user]);

  const clearNewMissedCount = useCallback(() => {
    setNewMissedCount(0);
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        userExtension,
        onlineExtensions,
        incomingVideoCall,
        activeVideoModal,
        missedCalls,
        newMissedCount,
        latestVoicemail,
        registerExtension,
        acceptVideoCall,
        declineVideoCall,
        closeActiveVideoModal,
        startVideoCall,
        clearNewMissedCount
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
