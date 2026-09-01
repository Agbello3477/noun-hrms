import crypto from 'crypto';

export interface TurnServerConfig {
  urls: string[];
  username: string;
  credential: string;
}

export interface IceServersResponse {
  iceServers: [
    { urls: string[] },
    TurnServerConfig
  ];
  expiresAt: number;
}

export function generateDynamicTurnCredentials(
  userId: string,
  ttlSeconds: number = 86400 // 24 hours default
): IceServersResponse {
  const secret = process.env.COTURN_AUTH_SECRET || 'YOUR_COTURN_SHARED_SECRET_KEY_HERE';
  const turnDomain = process.env.COTURN_DOMAIN || 'turn.yourdomain.com';

  // Calculate expiration timestamp (in seconds)
  const expiryTimestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
  
  // Format username: "<expiry_timestamp>:<unique_identifier>"
  const username = `${expiryTimestamp}:${userId}`;

  // Generate HMAC-SHA1 signature encoded in Base64
  const credential = crypto
    .createHmac('sha1', secret)
    .update(username)
    .digest('base64');

  return {
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          `stun:${turnDomain}:3478`
        ]
      },
      {
        urls: [
          `turn:${turnDomain}:3478?transport=udp`,
          `turn:${turnDomain}:3478?transport=tcp`,
          `turns:${turnDomain}:5349?transport=tcp`
        ],
        username,
        credential
      }
    ],
    expiresAt: expiryTimestamp * 1000
  };
}
