export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    // Public STUN server for initial candidate discovery
    {
      urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:turn.yourdomain.com:3478'],
    },
    // Dedicated Coturn TURN server for symmetric NAT traversal
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

  constructor(
    private iceServers: IceServerConfig[] = DEFAULT_ICE_SERVERS,
    private onIceCandidate?: (candidate: RTCIceCandidate) => void,
    private onTrackReceived?: (remoteStream: MediaStream) => void
  ) {}

  public async getAudioStream(): Promise<MediaStream> {
    if (this.localStream) return this.localStream;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: false
      });
      return this.localStream;
    } catch (error: any) {
      console.error('[WebRTC] Microphones access error:', error);
      throw new Error('Microphone access denied or device unavailable.');
    }
  }

  public async initializePeerConnection(): Promise<RTCPeerConnection> {
    if (this.peerConnection) return this.peerConnection;

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers
    });

    this.remoteStream = new MediaStream();

    // Attach local audio track to Peer Connection
    const localStream = await this.getAudioStream();
    localStream.getTracks().forEach((track) => {
      if (this.peerConnection) {
        this.peerConnection.addTrack(track, localStream);
      }
    });

    // Handle incoming remote audio tracks
    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else if (this.remoteStream) {
        this.remoteStream.addTrack(event.track);
      }
      if (this.onTrackReceived && this.remoteStream) {
        this.onTrackReceived(this.remoteStream);
      }
    };

    // Handle ICE Candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(event.candidate);
      }
    };

    return this.peerConnection;
  }

  private pendingCandidates: RTCIceCandidateInit[] = [];

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    const pc = await this.initializePeerConnection();
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    });

    // Enforce Opus Codec in SDP
    const modifiedSdp = this.preferOpusCodec(offer.sdp || '');
    await pc.setLocalDescription({ type: offer.type, sdp: modifiedSdp });
    return pc.localDescription!;
  }

  public async handleOfferAndCreateAnswer(offerSdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const pc = await this.initializePeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    await this.flushPendingCandidates();

    const answer = await pc.createAnswer();
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

  private async flushPendingCandidates(): Promise<void> {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[WebRTC] Error flushing ICE candidate:', err);
        }
      }
    }
  }

  // Ensure Opus audio codec is prioritized for <40kbps minimal bandwidth usage
  private preferOpusCodec(sdp: string): string {
    const sdpLines = sdp.split('\r\n');
    const mLineIndex = sdpLines.findIndex((line) => line.startsWith('m=audio'));
    if (mLineIndex === -1) return sdp;

    const opusPayloadType = sdpLines.find((line) => line.includes('a=rtpmap') && line.toLowerCase().includes('opus'));
    if (!opusPayloadType) return sdp;

    const match = opusPayloadType.match(/a=rtpmap:(\d+)\s+opus/i);
    if (!match) return sdp;

    const opusPt = match[1];
    const mLineElements = sdpLines[mLineIndex].split(' ');
    const header = mLineElements.slice(0, 3);
    const payloads = mLineElements.slice(3).filter((pt) => pt !== opusPt);
    mLineElements.splice(0, mLineElements.length, ...header, opusPt, ...payloads);
    sdpLines[mLineIndex] = mLineElements.join(' ');

    return sdpLines.join('\r\n');
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
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.localStream = null;
    this.remoteStream = null;
  }
}
