// Content script injected into NOUN HRMS Web App to sync active auth session
(function() {
  let hasShownSyncToast = false;

  function showInPortalSyncToast(userName) {
    if (hasShownSyncToast || document.getElementById('noun-extension-sync-toast')) return;
    hasShownSyncToast = true;

    const toast = document.createElement('div');
    toast.id = 'noun-extension-sync-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 999999;
      background: #006533;
      color: #ffffff;
      padding: 10px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 101, 51, 0.35);
      border: 1.5px solid #eab308;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: nounSlideIn 0.3s ease-out;
      cursor: pointer;
    `;

    toast.innerHTML = `
      <span style="font-size: 16px;">🏛️</span>
      <div>
        <div style="font-weight: 700; color: #ffffff;">Desktop Companion Connected</div>
        <div style="font-size: 11px; color: #fef08a;">${userName ? `Synced as ${userName}` : 'Session synchronized with Chrome Extension'}</div>
      </div>
    `;

    toast.title = "Click to dismiss. Access the extension anytime via Chrome's toolbar (🧩 top-right).";

    toast.addEventListener('click', () => {
      toast.remove();
    });

    document.body.appendChild(toast);

    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.style.transition = 'opacity 0.5s ease';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
      }
    }, 6000);
  }

  function syncAuthFromPortal() {
    try {
      const token = localStorage.getItem('token');
      const userRaw = sessionStorage.getItem('noun_hrms_user_cache');
      let user = null;
      if (userRaw) {
        try { user = JSON.parse(userRaw); } catch(e) {}
      }

      if (token) {
        chrome.runtime.sendMessage({
          type: 'PORTAL_SESSION_SYNC',
          payload: { token, user }
        }, (response) => {
          if (chrome.runtime.lastError) return;
          if (user?.name || user?.email) {
            showInPortalSyncToast(user.name || user.email);
          }
        });
      }
    } catch (err) {
      console.debug('[NOUN HRMS Extension] Portal sync check:', err);
    }
  }

  // Sync on initial load and on visibility / storage events
  syncAuthFromPortal();
  window.addEventListener('focus', syncAuthFromPortal);
  window.addEventListener('storage', (e) => {
    if (e.key === 'token') {
      syncAuthFromPortal();
    }
  });

  // Listen for direct sync requests from popup/service worker
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'REQUEST_PORTAL_SESSION') {
      const token = localStorage.getItem('token');
      const userRaw = sessionStorage.getItem('noun_hrms_user_cache');
      let user = null;
      if (userRaw) {
        try { user = JSON.parse(userRaw); } catch(e) {}
      }
      sendResponse({ token, user, status: 'OK' });
    }
    return true;
  });
})();
