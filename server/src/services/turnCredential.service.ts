import crypto from 'crypto';

export interface TurnServerConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface IceServersResponse {
  iceServers: TurnServerConfig[];
  expiresAt: number;
}

export function generateDynamicTurnCredentials(
  userId: string,
  ttlSeconds: number = 86400 // 24 hours default
): IceServersResponse {
  const secret = process.env.COTURN_AUTH_SECRET;
  const turnDomain = process.env.COTURN_DOMAIN;

  // Calculate expiration timestamp (in seconds)
  const expiryTimestamp = Math.floor(Date.now() / 1000) + ttlSeconds;

  const publicStunServers: TurnServerConfig = {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun4.l.google.com:19302',
      'stun:stun.cloudflare.com:3478',
      'stun:stun.services.mozilla.com:3478'
    ]
  };

  const iceServers: TurnServerConfig[] = [publicStunServers];

  // Only attach dynamic TURN credentials if a real, non-placeholder TURN domain is configured
  if (
    turnDomain &&
    turnDomain !== 'turn.yourdomain.com' &&
    secret &&
    secret !== 'YOUR_COTURN_SHARED_SECRET_KEY_HERE'
  ) {
    const username = `${expiryTimestamp}:${userId}`;
    const credential = crypto
      .createHmac('sha1', secret)
      .update(username)
      .digest('base64');

    iceServers.push({
      urls: [
        `turn:${turnDomain}:3478?transport=udp`,
        `turn:${turnDomain}:3478?transport=tcp`,
        `turns:${turnDomain}:5349?transport=tcp`
      ],
      username,
      credential
    });
  }

  return {
    iceServers,
    expiresAt: expiryTimestamp * 1000
  };
}

