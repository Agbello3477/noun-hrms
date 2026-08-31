// NOUN HRMS Manifest V3 Background Service Worker
import { getConfig, apiRequest, clipLiteratureToProject } from '../lib/api.js';

let socket = null;
let isConnectingSocket = false;

// ── Service Worker Lifecycle ─────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[NOUN HRMS Service Worker] Extension installed/updated.');
  // Set default periodic alarm for token refresh & healthcheck
  chrome.alarms.create('nounHeartbeat', { periodInMinutes: 5 });
  await initWebSocketSignaling();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'nounHeartbeat') {
    const config = await getConfig();
    if (config.token) {
      await initWebSocketSignaling();
    }
  }
});

// ── Native Desktop Notifications ─────────────────────────────────────────────
async function showDesktopNotification(id, options) {
  try {
    chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title: options.title || 'NOUN Enterprise Portal',
      message: options.message || '',
      priority: options.priority || 2,
      buttons: options.buttons || [{ title: 'Open Portal' }]
    });
  } catch (err) {
    console.error('[Notification Error]:', err);
  }
}

// ── WebSocket & VoIP Signaling Engine ─────────────────────────────────────────
async function initWebSocketSignaling() {
  const config = await getConfig();
  if (!config.token) {
    if (socket) {
      try { socket.close(); } catch(e) {}
      socket = null;
    }
    return;
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    return; // Already connected
  }

  if (isConnectingSocket) return;
  isConnectingSocket = true;

  try {
    // Derive WS URL from HTTP API base
    const wsUrl = config.apiBase.replace(/^http/, 'ws');
    
    // Connect to WebSocket server with token in query params
    socket = new WebSocket(`${wsUrl}/api/collaboration/doc?token=${encodeURIComponent(config.token)}`);

    socket.onopen = () => {
      isConnectingSocket = false;
      console.log('[NOUN HRMS WS] Connected to enterprise signaling gateway.');
      chrome.action.setBadgeText({ text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ color: '#006533' });
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleSignalingEvent(msg);
      } catch (err) {
        // Non-JSON message (binary stream)
      }
    };

    socket.onclose = () => {
      isConnectingSocket = false;
      socket = null;
      chrome.action.setBadgeText({ text: '' });
    };

    socket.onerror = () => {
      isConnectingSocket = false;
    };
  } catch (err) {
    isConnectingSocket = false;
    console.debug('[NOUN HRMS WS] Signaling connection failed:', err);
  }
}

function handleSignalingEvent(msg) {
  const type = msg?.type || msg?.event;
  const data = msg?.data || msg?.payload || msg;

  if (type === 'INCOMING_CALL') {
    showDesktopNotification(`call_${data.callId || Date.now()}`, {
      title: '📞 Incoming NOUN VoIP Call',
      message: `Incoming call from ${data.callerName || 'Staff Colleague'} (Ext: ${data.callerExtension || '1000'})`,
      priority: 2,
      buttons: [{ title: 'Answer Call' }, { title: 'Decline' }]
    });
  } else if (type === 'VIDEO_CALL_INCOMING') {
    showDesktopNotification(`video_${data.roomName || Date.now()}`, {
      title: '📹 Incoming Video Meeting',
      message: `${data.callerName} initiated: ${data.title || 'Video Conference Meeting'}`,
      priority: 2,
      buttons: [{ title: 'Join Video Call' }]
    });
  } else if (type === 'CALL_MISSED') {
    showDesktopNotification(`missed_${Date.now()}`, {
      title: '⚠️ Missed VoIP Call',
      message: `You missed a call from ${data.callerName} (Ext: ${data.callerExtension})`,
      priority: 1
    });
  } else if (type === 'VOICEMAIL_RECEIVED') {
    showDesktopNotification(`voicemail_${Date.now()}`, {
      title: '🎙️ New Voicemail / Audio Note',
      message: `New voice message received from Extension ${data.callerExtension || 'colleague'}.`,
      priority: 1
    });
  } else if (type === 'SECURITY_ALERT' || type === 'SECURITY_PTT_TALK_START') {
    showDesktopNotification(`sec_${Date.now()}`, {
      title: '🚨 NOUN SECURITY COMMAND ALERT',
      message: data.message || 'Security dispatch alert broadcasted.',
      priority: 2
    });
  }
}

// ── Notification Click Handlers ──────────────────────────────────────────────
chrome.notifications.onButtonClicked.addListener(async (notifId, buttonIndex) => {
  const config = await getConfig();
  let targetPath = '/dashboard';

  if (notifId.startsWith('call_')) {
    targetPath = '/dashboard/voip';
  } else if (notifId.startsWith('video_')) {
    targetPath = '/dashboard/research';
  } else if (notifId.startsWith('sec_')) {
    targetPath = '/dashboard/security';
  }

  const url = `${config.portalBase}${targetPath}`;
  chrome.tabs.create({ url });
  chrome.notifications.clear(notifId);
});

chrome.notifications.onClicked.addListener(async (notifId) => {
  const config = await getConfig();
  chrome.tabs.create({ url: `${config.portalBase}/dashboard` });
  chrome.notifications.clear(notifId);
});

// ── Runtime Message Passing ──────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const type = message?.type;
    const payload = message?.payload;

    if (type === 'PORTAL_SESSION_SYNC') {
      if (payload?.token) {
        await chrome.storage.local.set({
          token: payload.token,
          user: payload.user || null,
          lastSyncedAt: new Date().toISOString()
        });
        await initWebSocketSignaling();
        sendResponse({ success: true });
      }
    } else if (type === 'QUICK_CLIP_TRIGGERED') {
      try {
        const config = await getConfig();
        if (!config.token) {
          sendResponse({ success: false, reason: 'AUTH_REQUIRED' });
          return;
        }

        // Get default or first project workspace
        const { activeProjectId } = await chrome.storage.local.get('activeProjectId');
        let targetProjectId = activeProjectId;

        if (!targetProjectId) {
          const projects = await apiRequest('/api/research');
          if (Array.isArray(projects) && projects.length > 0) {
            targetProjectId = projects[0].id;
            await chrome.storage.local.set({ activeProjectId: targetProjectId });
          }
        }

        if (!targetProjectId) {
          sendResponse({ success: false, reason: 'NO_PROJECT_FOUND' });
          return;
        }

        await clipLiteratureToProject(targetProjectId, payload);
        sendResponse({ success: true, projectId: targetProjectId });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    } else if (type === 'RECONNECT_SIGNALING') {
      await initWebSocketSignaling();
      sendResponse({ success: true });
    }
  })();
  return true; // Keep channel open for async response
});
