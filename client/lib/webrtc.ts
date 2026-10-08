import api from './api';

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    // High-availability public STUN servers for reliable NAT traversal
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
        'stun:stun.services.mozilla.com:3478'
      ],
    }
  ],
  iceCandidatePoolSize: 10,
};

export const DEFAULT_ICE_SERVERS: IceServerConfig[] = rtcConfiguration.iceServers as IceServerConfig[];

let cachedIceServers: { servers: IceServerConfig[]; expiresAt: number } | null = null;

/**
 * Ephemeral dynamic TURN credential fetcher (HMAC-SHA1) with caching
 */
export const fetchDynamicIceServers = async (authToken?: string): Promise<IceServerConfig[]> => {
  const now = Date.now();
  if (cachedIceServers && cachedIceServers.expiresAt > now + 60000) {
    return cachedIceServers.servers;
  }

  try {
    const token = authToken || (typeof window !== 'undefined' ? sessionStorage.getItem('token') : null);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const { data } = await api.get('/api/v1/webrtc/ice-servers', { headers });
    if (data?.iceServers && Array.isArray(data.iceServers)) {
      // Filter out any placeholder / invalid domains
      const validFetched = data.iceServers.filter((s: IceServerConfig) => {
        const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
        return urls.every((u) => !u.includes('yourdomain.com'));
      });

      const mergedServers: IceServerConfig[] = [
        ...DEFAULT_ICE_SERVERS,
        ...validFetched
      ];

      cachedIceServers = {
        servers: mergedServers,
        expiresAt: data.expiresAt || (now + 12 * 3600 * 1000)
      };
      return mergedServers;
    }
  } catch (err) {
    console.warn('[WebRTC] Falling back to default ICE servers:', err);
  }

  return DEFAULT_ICE_SERVERS;
};

/**
 * Creates an RTCPeerConnection with dynamic ICE credentials
 */
export async function createPeerConnection(authToken?: string): Promise<RTCPeerConnection> {
  const iceServers = await fetchDynamicIceServers(authToken);
  return new RTCPeerConnection({
    iceServers,
    iceCandidatePoolSize: 10
  });
}

// Helper to stop all tracks and release microphone media hardware completely
export const stopMediaStreamTracks = (stream: MediaStream | null): void => {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      track.stop();
      stream.removeTrack(track);
    });
  } catch (err) {
    console.error('[WebRTC] Error releasing media tracks:', err);
  }
};

export class VoipPeerManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(
    private iceServers: IceServerConfig[] = DEFAULT_ICE_SERVERS,
    private onIceCandidate?: (candidate: RTCIceCandidate) => void,
    private onTrackReceived?: (remoteStream: MediaStream) => void
  ) {}

  public async getAudioStream(): Promise<MediaStream> {
    if (this.localStream && this.localStream.active && this.localStream.getAudioTracks().some(t => t.readyState === 'live')) {
      return this.localStream;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      // Ensure every audio track is active and unmuted
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
        console.log('[WebRTC] Local microphone track acquired:', track.id, 'label:', track.label);
      });

      return this.localStream;
    } catch (error: any) {
      console.error('[WebRTC] Microphone access error:', error);
      throw new Error('Microphone access denied or audio device unavailable.');
    }
  }

  public async initializePeerConnection(): Promise<RTCPeerConnection> {
    if (this.peerConnection) return this.peerConnection;

    const validIceServers = this.iceServers && this.iceServers.length > 0
      ? this.iceServers.filter(s => {
          const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
          return urls.every(u => !u.includes('yourdomain.com'));
        })
      : DEFAULT_ICE_SERVERS;

    const pc = new RTCPeerConnection({
      iceServers: validIceServers.length > 0 ? validIceServers : DEFAULT_ICE_SERVERS,
      iceCandidatePoolSize: 10
    });
    this.peerConnection = pc;

    this.remoteStream = new MediaStream();

    // Attach local audio track to Peer Connection
    const localStream = await this.getAudioStream();
    localStream.getAudioTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    // Apply W3C standard Opus codec preferences across transceivers
    this.applyCodecPreferences(pc);

    // Handle incoming remote audio tracks with live unmute listener
    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event.track.kind, event.track.id, 'readyState:', event.track.readyState, 'enabled:', event.track.enabled);
      let stream: MediaStream;
      if (event.streams && event.streams[0]) {
        stream = event.streams[0];
        this.remoteStream = stream;
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
        stream = this.remoteStream;
      }

      const dispatchRemoteStream = () => {
        if (this.onTrackReceived && stream) {
          console.log('[WebRTC] Dispatching remote audio stream to listeners');
          this.onTrackReceived(stream);
        }
      };

      dispatchRemoteStream();

      // Listen for track unmute when first network RTP audio packets arrive
      event.track.onunmute = () => {
        console.log('[WebRTC] Remote audio track unmuted and active');
        dispatchRemoteStream();
      };
    };

    // Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        console.log('[WebRTC] Local ICE candidate gathered:', event.candidate.type, event.candidate.protocol, event.candidate.address || event.candidate.relatedAddress);
        this.onIceCandidate(event.candidate);
      }
    };

    // Monitor Connection States for diagnostics and auto-recovery
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE Connection State changed to:', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Peer Connection State changed to:', pc.connectionState);
    };

    pc.onsignalingstatechange = () => {
      console.log('[WebRTC] Signaling State changed to:', pc.signalingState);
    };

    return pc;
  }

  private applyCodecPreferences(pc: RTCPeerConnection): void {
    try {
      if (typeof RTCRtpSender !== 'undefined' && typeof RTCRtpSender.getCapabilities === 'function') {
        const capabilities = RTCRtpSender.getCapabilities('audio');
        if (capabilities && capabilities.codecs) {
          const opusCodecs = capabilities.codecs.filter(c => c.mimeType.toLowerCase() === 'audio/opus');
          const otherCodecs = capabilities.codecs.filter(c => c.mimeType.toLowerCase() !== 'audio/opus');
          const preferredCodecs = [...opusCodecs, ...otherCodecs];

          pc.getTransceivers().forEach((transceiver) => {
            if (transceiver.receiver.track.kind === 'audio' && typeof transceiver.setCodecPreferences === 'function') {
              try {
                transceiver.setCodecPreferences(preferredCodecs);
                console.log('[WebRTC] Successfully set Opus codec preference via standard setCodecPreferences');
              } catch (err) {
                console.warn('[WebRTC] setCodecPreferences non-critical warning:', err);
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn('[WebRTC] Codec preference discovery not available:', e);
    }
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    const pc = await this.initializePeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return pc.localDescription!;
  }

  public async handleOfferAndCreateAnswer(offerSdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const pc = await this.initializePeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    await this.flushPendingCandidates();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return pc.localDescription!;
  }

  public async handleAnswer(answerSdp: RTCSessionDescriptionInit): Promise<void> {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerSdp));
      await this.flushPendingCandidates();
    }
  }

  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!candidate || !candidate.candidate) return;

    if (this.peerConnection && this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] Error adding ICE candidate:', err);
      }
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  public async flushPendingCandidates(): Promise<void> {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate && candidate.candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[WebRTC] Error flushing ICE candidate:', err);
        }
      }
    }
  }

  public setMicrophoneMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
      console.log(`[WebRTC] Microphone ${muted ? 'MUTED' : 'UNMUTED'}`);
    }
  }

  public cleanup(): void {
    stopMediaStreamTracks(this.localStream);
    stopMediaStreamTracks(this.remoteStream);

    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.onsignalingstatechange = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.pendingCandidates = [];
    this.localStream = null;
    this.remoteStream = null;
  }
}

export interface RemotePeerState {
  userId: string;
  socketId?: string;
  userName: string;
  userRole?: string;
  avatarUrl?: string;
  peerConnection: RTCPeerConnection;
  stream: MediaStream;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isSpeaking: boolean;
  audioLevel: number;
}

export interface MeshSignalPayload {
  type: 'offer' | 'answer' | 'candidate';
  targetUserId: string;
  targetSocketId?: string;
  senderUserId: string;
  senderSocketId?: string;
  data: any;
  roomId: string;
}

export class MultiPeerMeshManager {
  private localUserId: string;
  private roomId: string;
  private iceServers: IceServerConfig[];
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peers: Map<string, RemotePeerState> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private makingOfferMap: Map<string, boolean> = new Map();
  private ignoreOfferMap: Map<string, boolean> = new Map();
  
  // Audio Analysis for speaking activity detection
  private audioContext: AudioContext | null = null;
  private peerAnalysers: Map<string, { analyser: AnalyserNode; intervalId: any }> = new Map();

  constructor(
    localUserId: string,
    roomId: string,
    iceServers: IceServerConfig[] = DEFAULT_ICE_SERVERS,
    private onSignal?: (signal: MeshSignalPayload) => void,
    private onPeerStreamUpdated?: (peer: RemotePeerState) => void,
    private onPeerDisconnected?: (userId: string) => void,
    private onSpeakingChange?: (userId: string, isSpeaking: boolean, audioLevel: number) => void
  ) {
    this.localUserId = localUserId;
    this.roomId = roomId;
    this.iceServers = iceServers;
  }

  public async initLocalStream(video: boolean = true, audio: boolean = true): Promise<MediaStream> {
    if (this.localStream && this.localStream.active) {
      return this.localStream;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } : false
      });
      return this.localStream;
    } catch (err) {
      console.warn('[MultiPeerMesh] Video camera failed, falling back to audio-only:', err);
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      return this.localStream;
    }
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getPeers(): RemotePeerState[] {
    return Array.from(this.peers.values());
  }

  public getPeer(userId: string): RemotePeerState | undefined {
    return this.peers.get(userId);
  }

  private isPolite(remoteUserId: string): boolean {
    // Polite peer pattern: lexicographically greater userId is polite
    return this.localUserId > remoteUserId;
  }

  public async addPeer(
    peerInfo: { userId: string; socketId?: string; userName?: string; userRole?: string; avatarUrl?: string },
    isInitiator: boolean = false
  ): Promise<RTCPeerConnection> {
    const remoteUid = peerInfo.userId;
    if (this.peers.has(remoteUid)) {
      return this.peers.get(remoteUid)!.peerConnection;
    }

    const validIceServers = this.iceServers.length > 0 ? this.iceServers : DEFAULT_ICE_SERVERS;
    const pc = new RTCPeerConnection({
      iceServers: validIceServers,
      iceCandidatePoolSize: 10
    });

    const remoteStream = new MediaStream();
    const peerState: RemotePeerState = {
      userId: remoteUid,
      socketId: peerInfo.socketId,
      userName: peerInfo.userName || 'Colleague',
      userRole: peerInfo.userRole || 'Staff',
      avatarUrl: peerInfo.avatarUrl,
      peerConnection: pc,
      stream: remoteStream,
      isAudioMuted: false,
      isVideoMuted: false,
      isSpeaking: false,
      audioLevel: 0
    };

    this.peers.set(remoteUid, peerState);
    this.makingOfferMap.set(remoteUid, false);
    this.ignoreOfferMap.set(remoteUid, false);

    // Attach local tracks if available
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // ICE Candidate Relay
    pc.onicecandidate = (event) => {
      if (event.candidate && this.onSignal) {
        this.onSignal({
          type: 'candidate',
          targetUserId: remoteUid,
          targetSocketId: peerInfo.socketId,
          senderUserId: this.localUserId,
          data: event.candidate,
          roomId: this.roomId
        });
      }
    };

    // Remote Track Handling
    pc.ontrack = (event) => {
      console.log(`[MultiPeerMesh] Received remote track from ${remoteUid}:`, event.track.kind);
      if (event.streams && event.streams[0]) {
        peerState.stream = event.streams[0];
      } else {
        peerState.stream.addTrack(event.track);
      }

      if (event.track.kind === 'audio') {
        this.setupAudioAnalysis(remoteUid, peerState.stream);
      }

      if (this.onPeerStreamUpdated) {
        this.onPeerStreamUpdated(peerState);
      }

      event.track.onunmute = () => {
        if (this.onPeerStreamUpdated) {
          this.onPeerStreamUpdated(peerState);
        }
      };
    };

    // Negotiation Needed
    pc.onnegotiationneeded = async () => {
      try {
        this.makingOfferMap.set(remoteUid, true);
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);

        if (this.onSignal) {
          this.onSignal({
            type: 'offer',
            targetUserId: remoteUid,
            targetSocketId: peerInfo.socketId,
            senderUserId: this.localUserId,
            data: pc.localDescription,
            roomId: this.roomId
          });
        }
      } catch (err) {
        console.error(`[MultiPeerMesh] Negotiation error with ${remoteUid}:`, err);
      } finally {
        this.makingOfferMap.set(remoteUid, false);
      }
    };

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      console.log(`[MultiPeerMesh] Connection with ${remoteUid} state:`, pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(remoteUid);
      }
    };

    // If initiator, trigger offer creation
    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (this.onSignal) {
          this.onSignal({
            type: 'offer',
            targetUserId: remoteUid,
            targetSocketId: peerInfo.socketId,
            senderUserId: this.localUserId,
            data: pc.localDescription,
            roomId: this.roomId
          });
        }
      } catch (err) {
        console.error(`[MultiPeerMesh] Initial offer error with ${remoteUid}:`, err);
      }
    }

    // Flush any queued candidates
    const queued = this.pendingCandidates.get(remoteUid) || [];
    if (queued.length > 0) {
      queued.forEach(async (cand) => {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {}
      });
      this.pendingCandidates.delete(remoteUid);
    }

    return pc;
  }

  public async handleRemoteOffer(
    senderUserId: string,
    offer: RTCSessionDescriptionInit,
    senderSocketId?: string,
    senderInfo?: { name?: string; role?: string; avatarUrl?: string }
  ): Promise<void> {
    let peerState = this.peers.get(senderUserId);
    if (!peerState) {
      await this.addPeer({
        userId: senderUserId,
        socketId: senderSocketId,
        userName: senderInfo?.name,
        userRole: senderInfo?.role,
        avatarUrl: senderInfo?.avatarUrl
      }, false);
      peerState = this.peers.get(senderUserId);
    }

    if (!peerState) return;
    const pc = peerState.peerConnection;
    const polite = this.isPolite(senderUserId);
    const readyForOffer = !this.makingOfferMap.get(senderUserId) && (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer');
    const offerCollision = !readyForOffer;

    this.ignoreOfferMap.set(senderUserId, !polite && offerCollision);
    if (this.ignoreOfferMap.get(senderUserId)) {
      console.warn(`[MultiPeerMesh] Glare detected. Impolite peer ignoring offer from ${senderUserId}`);
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (this.onSignal) {
        this.onSignal({
          type: 'answer',
          targetUserId: senderUserId,
          targetSocketId: senderSocketId || peerState.socketId,
          senderUserId: this.localUserId,
          data: pc.localDescription,
          roomId: this.roomId
        });
      }
    } catch (err) {
      console.error(`[MultiPeerMesh] Error handling offer from ${senderUserId}:`, err);
    }
  }

  public async handleRemoteAnswer(senderUserId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peerState = this.peers.get(senderUserId);
    if (!peerState) return;

    try {
      if (peerState.peerConnection.signalingState === 'have-local-offer') {
        await peerState.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (err) {
      console.error(`[MultiPeerMesh] Error setting remote answer from ${senderUserId}:`, err);
    }
  }

  public async handleRemoteCandidate(senderUserId: string, candidate: RTCIceCandidateInit): Promise<void> {
    if (!candidate || !candidate.candidate) return;
    const peerState = this.peers.get(senderUserId);

    if (peerState && peerState.peerConnection.remoteDescription) {
      try {
        await peerState.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        if (!this.ignoreOfferMap.get(senderUserId)) {
          console.warn(`[MultiPeerMesh] Error adding ICE candidate from ${senderUserId}:`, err);
        }
      }
    } else {
      const list = this.pendingCandidates.get(senderUserId) || [];
      list.push(candidate);
      this.pendingCandidates.set(senderUserId, list);
    }
  }

  private setupAudioAnalysis(userId: string, stream: MediaStream): void {
    try {
      if (typeof window === 'undefined') return;
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;

      const intervalId = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const isSpeaking = avg > 15;

        const peer = this.peers.get(userId);
        if (peer) {
          peer.audioLevel = avg;
          peer.isSpeaking = isSpeaking;
        }

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          if (this.onSpeakingChange) {
            this.onSpeakingChange(userId, isSpeaking, avg);
          }
        }
      }, 150);

      this.peerAnalysers.set(userId, { analyser, intervalId });
    } catch (e) {
      console.warn('[MultiPeerMesh] Web Audio analysis not supported:', e);
    }
  }

  public removePeer(userId: string): void {
    const peer = this.peers.get(userId);
    if (peer) {
      stopMediaStreamTracks(peer.stream);
      peer.peerConnection.close();
      this.peers.delete(userId);
    }

    const analyserData = this.peerAnalysers.get(userId);
    if (analyserData) {
      clearInterval(analyserData.intervalId);
      this.peerAnalysers.delete(userId);
    }

    this.pendingCandidates.delete(userId);
    this.makingOfferMap.delete(userId);
    this.ignoreOfferMap.delete(userId);

    if (this.onPeerDisconnected) {
      this.onPeerDisconnected(userId);
    }
  }

  public setAudioMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public setVideoMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public async startScreenShare(): Promise<MediaStream | null> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      this.screenStream = screenStream;

      const screenTrack = screenStream.getVideoTracks()[0];
      // Replace video track on all peer connections
      this.peers.forEach((peer) => {
        const senders = peer.peerConnection.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }
      });

      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      return screenStream;
    } catch (err) {
      console.error('[MultiPeerMesh] Screen share error:', err);
      return null;
    }
  }

  public stopScreenShare(): void {
    if (this.screenStream) {
      stopMediaStreamTracks(this.screenStream);
      this.screenStream = null;

      // Restore camera video track
      if (this.localStream) {
        const cameraTrack = this.localStream.getVideoTracks()[0];
        if (cameraTrack) {
          this.peers.forEach((peer) => {
            const senders = peer.peerConnection.getSenders();
            const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
            if (videoSender) {
              videoSender.replaceTrack(cameraTrack);
            }
          });
        }
      }
    }
  }

  public cleanup(): void {
    stopMediaStreamTracks(this.localStream);
    stopMediaStreamTracks(this.screenStream);

    Array.from(this.peers.keys()).forEach((userId) => {
      this.removePeer(userId);
    });

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.peers.clear();
    this.peerAnalysers.clear();
    this.pendingCandidates.clear();
    this.localStream = null;
    this.screenStream = null;
  }
}


