// Content script injected into NOUN HRMS Web App to sync active auth session
(function() {
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
        });
      }
    } catch (err) {
      console.debug('[NOUN HRMS Extension] Portal sync check:', err);
    }
  }

  // Sync on load and on visibility change
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
