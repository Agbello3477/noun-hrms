// NOUN HRMS Desktop Companion - Popup Logic
import {
  getConfig,
  setAuth,
  clearAuth,
  verifyCurrentAuth,
  loginWithCredentials,
  getResearchProjects,
  clipLiteratureToProject,
  submitEmergencyIncident
} from '../lib/api.js';

let activeMetadata = null;

document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  await refreshUserState();
  await loadAcademicMetadata();
  setupEventListeners();
});

// ── Tab Management ───────────────────────────────────────────────────────────
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      const content = document.getElementById(`tab-${targetTab}`);
      if (content) content.classList.add('active');
    });
  });
}

// ── Auth & User State ────────────────────────────────────────────────────────
async function refreshUserState() {
  const dot = document.getElementById('connection-dot');
  const nameEl = document.getElementById('user-display-name');
  const emailEl = document.getElementById('user-display-email');
  const roleBadge = document.getElementById('user-role-badge');
  const extBadge = document.getElementById('user-ext-badge');
  const logoutBtn = document.getElementById('btn-logout');
  const warningBox = document.getElementById('clipper-auth-warning');

  const config = await getConfig();
  let user = config.user;

  if (config.token && !user) {
    user = await verifyCurrentAuth();
  }

  if (user) {
    dot.className = 'dot online';
    dot.title = 'Connected & Authenticated';
    nameEl.innerText = user.name || 'Staff User';
    emailEl.innerText = user.email || '';
    roleBadge.innerText = user.role || 'STAFF';

    const ext = user.staffProfile?.voipExtension;
    if (ext) {
      extBadge.innerText = `Ext: ${ext}`;
      extBadge.classList.remove('hidden');
    } else {
      extBadge.classList.add('hidden');
    }

    logoutBtn.classList.remove('hidden');
    if (warningBox) warningBox.classList.add('hidden');

    await loadResearchProjects();
  } else {
    dot.className = 'dot offline';
    dot.title = 'Offline / Unauthenticated';
    nameEl.innerText = 'Not Signed In';
    emailEl.innerText = 'Sync with portal or sign in below';
    roleBadge.innerText = 'Guest';
    extBadge.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    if (warningBox) warningBox.classList.remove('hidden');
  }
}

// ── Research Workspace Projects ──────────────────────────────────────────────
async function loadResearchProjects() {
  const select = document.getElementById('project-select');
  try {
    const projects = await getResearchProjects();
    select.innerHTML = '';

    if (!Array.isArray(projects) || projects.length === 0) {
      select.innerHTML = '<option value="">No active research projects found</option>';
      return;
    }

    const { activeProjectId } = await chrome.storage.local.get('activeProjectId');

    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.innerText = p.title || 'Untitled Project';
      if (activeProjectId === p.id) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    select.addEventListener('change', async () => {
      await chrome.storage.local.set({ activeProjectId: select.value });
    });
  } catch (err) {
    select.innerHTML = '<option value="">Failed to load projects</option>';
  }
}

// ── Academic Literature Metadata Extraction ──────────────────────────────────
async function loadAcademicMetadata() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    chrome.tabs.sendMessage(tab.id, { type: 'GET_ACADEMIC_METADATA' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Tab does not have content script injected (not an academic domain)
        return;
      }
      populateMetadataFields(response);
    });
  } catch (err) {
    console.debug('Error querying active tab:', err);
  }
}

function populateMetadataFields(meta) {
  activeMetadata = meta;
  if (meta.title) document.getElementById('meta-title').value = meta.title;
  if (meta.authors) {
    document.getElementById('meta-authors').value = Array.isArray(meta.authors) ? meta.authors.join(', ') : meta.authors;
  }
  if (meta.year) document.getElementById('meta-year').value = meta.year;
  if (meta.doi) document.getElementById('meta-doi').value = meta.doi;
  if (meta.abstract) document.getElementById('meta-abstract').value = meta.abstract;
}

// ── Event Handlers ───────────────────────────────────────────────────────────
function setupEventListeners() {
  // Refresh Metadata Button
  document.getElementById('btn-refresh-meta').addEventListener('click', async () => {
    await loadAcademicMetadata();
  });

  // Clip Article Button
  document.getElementById('btn-clip-save').addEventListener('click', async () => {
    const banner = document.getElementById('clip-status-msg');
    const projectSelect = document.getElementById('project-select');
    const projectId = projectSelect.value;

    if (!projectId) {
      showBanner(banner, 'Please select a target Research Workspace project', 'error');
      return;
    }

    const payload = {
      title: document.getElementById('meta-title').value.trim(),
      authors: document.getElementById('meta-authors').value.trim(),
      year: document.getElementById('meta-year').value.trim(),
      doi: document.getElementById('meta-doi').value.trim(),
      abstract: document.getElementById('meta-abstract').value.trim(),
      url: activeMetadata?.url || ''
    };

    if (!payload.title) {
      showBanner(banner, 'Publication title is required', 'error');
      return;
    }

    const btn = document.getElementById('btn-clip-save');
    btn.disabled = true;
    btn.querySelector('.btn-text').innerText = 'Saving Citation...';

    try {
      await clipLiteratureToProject(projectId, payload);
      showBanner(banner, '✅ Successfully clipped to Research Forum Workspace!', 'success');
    } catch (err) {
      showBanner(banner, `Failed to clip: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.querySelector('.btn-text').innerText = '📥 Clip to Research Forum';
    }
  });

  // Emergency SOS Form
  document.getElementById('emergency-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const banner = document.getElementById('sos-status-msg');
    const btn = document.getElementById('btn-submit-sos');

    const payload = {
      category: document.getElementById('sos-category').value,
      title: document.getElementById('sos-title').value.trim(),
      location: document.getElementById('sos-location').value.trim(),
      description: document.getElementById('sos-description').value.trim(),
      isAnonymous: document.getElementById('sos-anonymous').checked
    };

    btn.disabled = true;
    btn.innerText = 'Transmitting SOS Ticket...';

    try {
      const incident = await submitEmergencyIncident(payload);
      showBanner(banner, `🚨 Incident Report Created! Ticket ID: ${incident.id?.slice(0, 8) || 'CONFIRMED'}`, 'success');
      document.getElementById('emergency-form').reset();
    } catch (err) {
      showBanner(banner, `Emergency submission error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerText = '🚨 Transmit Emergency Ticket';
    }
  });

  // Sync from Active Portal Tab
  document.getElementById('btn-sync-session').addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-session');
    btn.innerText = 'Syncing...';
    try {
      const tabs = await chrome.tabs.query({ url: ['https://nounhrms.web.app/*', 'http://localhost:3000/*'] });
      if (tabs.length === 0) {
        alert('Please open or log into NOUN HRMS Portal (nounhrms.web.app) in one of your browser tabs first.');
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_PORTAL_SESSION' }, async (resp) => {
        if (resp?.token) {
          await setAuth(resp.token, resp.user);
          chrome.runtime.sendMessage({ type: 'RECONNECT_SIGNALING' });
          await refreshUserState();
          alert('Session synced successfully with web portal!');
        } else {
          alert('No active login token found in portal tab. Please sign into the portal first.');
        }
      });
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      btn.innerText = '🔄 Sync from Active Portal Tab';
    }
  });

  // Manual Direct Sign In
  document.getElementById('manual-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-manual-login');

    if (!email || !password) return;

    btn.disabled = true;
    btn.innerText = 'Signing in...';

    try {
      await loginWithCredentials(email, password);
      chrome.runtime.sendMessage({ type: 'RECONNECT_SIGNALING' });
      await refreshUserState();
      document.getElementById('manual-login-form').reset();
    } catch (err) {
      alert(`Sign in failed: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.innerText = 'Direct Sign In';
    }
  });

  // Save Server Configuration
  document.getElementById('btn-save-config').addEventListener('click', async () => {
    const apiBase = document.getElementById('cfg-api-base').value.trim();
    const portalBase = document.getElementById('cfg-portal-base').value.trim();
    await chrome.storage.local.set({ apiBase, portalBase });
    chrome.runtime.sendMessage({ type: 'RECONNECT_SIGNALING' });
    alert('Server configuration updated.');
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await clearAuth();
    chrome.runtime.sendMessage({ type: 'RECONNECT_SIGNALING' });
    await refreshUserState();
  });
}

function showBanner(el, message, type = 'success') {
  el.className = `status-banner ${type}`;
  el.innerText = message;
  el.classList.remove('hidden');
  setTimeout(() => {
    el.classList.add('hidden');
  }, 5000);
}
