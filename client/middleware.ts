import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Resolve host to dynamically determine the target backend API environment
  const host = request.headers.get('host') || '';
  let apiBaseUrl = 'https://noun-hrms.onrender.com';
  
  if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('3000') || host.includes('3001')) {
    apiBaseUrl = 'http://localhost:5055';
  } else if (host.includes('staging')) {
    apiBaseUrl = 'https://noun-hrms-staging.onrender.com';
  }
  
  const apiDomain = apiBaseUrl.replace('https://', '').replace('http://', '');
  const wsProto = apiBaseUrl.startsWith('https') ? 'wss' : 'ws';

  const cspDirectives = [
    "default-src 'self'",
    // Whitelist JSZip (cdnjs) and Jitsi (meet.jit.si) script loads
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://meet.jit.si https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    // Whitelist image sources and placeholder images
    "img-src 'self' data: https://via.placeholder.com",
    "font-src 'self' data:",
    // Whitelist Jitsi video iframe embeds
    "frame-src 'self' https://meet.jit.si",
    // Whitelist API connection channels, sockets, and FCM registries
    `connect-src 'self' ${apiBaseUrl} ${wsProto}://${apiDomain} https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com`,
    // Route violation logs to the observability endpoint in report-only mode
    `report-uri ${apiBaseUrl}/api/observability/csp-report`
  ];

  response.headers.set('Content-Security-Policy-Report-Only', cspDirectives.join('; '));
  return response;
}

export const config = {
  matcher: [
    // Apply to all routes except public assets and internal next paths
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
