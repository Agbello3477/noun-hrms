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

