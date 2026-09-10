import api from './api';

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    // High-availability public Google STUN servers
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
      ],
    },
    // Dedicated Coturn TURN server fallback for symmetric NAT traversal
    {
      urls: [
        'turn:turn.yourdomain.com:3478?transport=udp',
        'turn:turn.yourdomain.com:3478?transport=tcp'
      ],
      username: 'turnuser',
      credential: 'StrongSecurePassword123!',
    },
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
      // Ensure public STUN is always included alongside dynamic TURN credentials
      const mergedServers: IceServerConfig[] = [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
          ]
        },
        ...data.iceServers
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
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        },
        video: false
      });

      // Ensure every track is actively enabled
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });

      return this.localStream;
    } catch (error: any) {
      console.error('[WebRTC] Microphone access error:', error);
      throw new Error('Microphone access denied or device unavailable.');
    }
  }

  public async initializePeerConnection(): Promise<RTCPeerConnection> {
    if (this.peerConnection) return this.peerConnection;

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10
    });
    this.peerConnection = pc;

    this.remoteStream = new MediaStream();

    // Attach local audio track to Peer Connection
    const localStream = await this.getAudioStream();
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    // Handle incoming remote audio tracks with live unmute listener
    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event.track.kind, event.track.id, 'readyState:', event.track.readyState);
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
          console.log('[WebRTC] Dispatching remote audio stream to caller/callee listeners');
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
        this.onIceCandidate(event.candidate);
      }
    };

    // Monitor ICE Connection State
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE Connection State changed to:', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Peer Connection State changed to:', pc.connectionState);
    };

    return pc;
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    const pc = await this.initializePeerConnection();
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    });

    // Line-break safe Opus Codec Priority in SDP
    const modifiedSdp = this.preferOpusCodec(offer.sdp || '');
    await pc.setLocalDescription({ type: offer.type, sdp: modifiedSdp });
    return pc.localDescription!;
  }

  public async handleOfferAndCreateAnswer(offerSdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const pc = await this.initializePeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    await this.flushPendingCandidates();

    const answer = await pc.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    });
    const modifiedSdp = this.preferOpusCodec(answer.sdp || '');
    await pc.setLocalDescription({ type: answer.type, sdp: modifiedSdp });
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

  // Ensure Opus audio codec is prioritized safely with line-ending normalization
  private preferOpusCodec(sdp: string): string {
    if (!sdp) return sdp;
    const lines = sdp.split(/\r\n|\r|\n/);
    const mLineIndex = lines.findIndex((line) => line.startsWith('m=audio'));
    if (mLineIndex === -1) return lines.join('\r\n');

    const opusPayloadType = lines.find((line) => line.includes('a=rtpmap') && line.toLowerCase().includes('opus'));
    if (!opusPayloadType) return lines.join('\r\n');

    const match = opusPayloadType.match(/a=rtpmap:(\d+)\s+opus/i);
    if (!match) return lines.join('\r\n');

    const opusPt = match[1];
    const mLineElements = lines[mLineIndex].split(' ');
    const header = mLineElements.slice(0, 3);
    const payloads = mLineElements.slice(3).filter((pt) => pt !== opusPt);
    lines[mLineIndex] = [...header, opusPt, ...payloads].join(' ');

    return lines.join('\r\n');
  }

  public setMicrophoneMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
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
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.pendingCandidates = [];
    this.localStream = null;
    this.remoteStream = null;
  }
}
