// NOUN HRMS Extension - API Client Library

export const DEFAULT_API_BASE = 'https://noun-hrms.onrender.com';
export const DEFAULT_PORTAL_BASE = 'https://nounhrms.web.app';

export async function getConfig() {
  const data = await chrome.storage.local.get(['apiBase', 'portalBase', 'token', 'user']);
  return {
    apiBase: data.apiBase || DEFAULT_API_BASE,
    portalBase: data.portalBase || DEFAULT_PORTAL_BASE,
    token: data.token || null,
    user: data.user || null
  };
}

export async function setAuth(token, user) {
  await chrome.storage.local.set({ 
    token, 
    user, 
    lastSyncedAt: new Date().toISOString() 
  });
}

export async function clearAuth() {
  await chrome.storage.local.remove(['token', 'user', 'lastSyncedAt']);
}

export async function apiRequest(endpoint, options = {}) {
  const config = await getConfig();
  const url = `${config.apiBase}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (config.token) {
    headers['Authorization'] = `Bearer ${config.token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        await clearAuth();
      }
      const errorMsg = data?.message || data?.error || `HTTP ${response.status}: Request failed`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (error) {
    console.error(`[NOUN HRMS API Error] ${endpoint}:`, error);
    throw error;
  }
}

// ── Auth Methods ─────────────────────────────────────────────────────────────
export async function verifyCurrentAuth() {
  try {
    const user = await apiRequest('/api/auth/me');
    const { token } = await getConfig();
    if (user && token) {
      await setAuth(token, user);
    }
    return user;
  } catch (err) {
    return null;
  }
}

export async function loginWithCredentials(email, password) {
  const result = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (result?.token && result?.user) {
    await setAuth(result.token, result.user);
  }
  return result;
}

// ── Research Forum Methods ───────────────────────────────────────────────────
export async function getResearchProjects() {
  return await apiRequest('/api/research');
}

export async function clipLiteratureToProject(projectId, metadata) {
  // 1. Get current document content
  const existing = await apiRequest(`/api/research/${projectId}/document`).catch(() => ({ contentHtml: '' }));
  const existingHtml = existing?.contentHtml || '';

  // 2. Format bibliographic citation block
  const authorsList = Array.isArray(metadata.authors) ? metadata.authors.join(', ') : (metadata.authors || 'Unknown Authors');
  const yearText = metadata.year ? ` (${metadata.year})` : '';
  const journalText = metadata.journal ? `<em>${escapeHtml(metadata.journal)}</em>` : '';
  const doiLink = metadata.doi ? `<a href="https://doi.org/${encodeURIComponent(metadata.doi)}" target="_blank" rel="noopener noreferrer">https://doi.org/${escapeHtml(metadata.doi)}</a>` : '';
  const sourceLink = metadata.url ? `<a href="${escapeHtml(metadata.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(metadata.url)}</a>` : '';
  const clippedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const citationCardHtml = `
<div class="academic-citation-card" style="margin: 16px 0; padding: 16px; border-left: 4px solid #006533; background: #f8fafc; border-radius: 8px; font-family: sans-serif;">
  <div style="font-size: 11px; font-weight: 700; color: #006533; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
    📚 Clipped Literature Reference • ${clippedDate}
  </div>
  <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 16px; font-weight: 700; line-height: 1.3;">
    ${escapeHtml(metadata.title || 'Untitled Publication')}
  </h4>
  <p style="margin: 0 0 6px 0; font-size: 13px; color: #334155;">
    <strong>Authors:</strong> ${escapeHtml(authorsList)}${yearText}
  </p>
  ${journalText ? `<p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;"><strong>Publication:</strong> ${journalText}</p>` : ''}
  ${doiLink ? `<p style="margin: 0 0 6px 0; font-size: 12px; color: #2563eb;"><strong>DOI:</strong> ${doiLink}</p>` : ''}
  ${sourceLink ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;"><strong>Source:</strong> ${sourceLink}</p>` : ''}
  ${metadata.abstract ? `
    <div style="margin-top: 10px; padding: 10px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; line-height: 1.5; color: #334155;">
      <strong>Abstract:</strong><br/>
      ${escapeHtml(metadata.abstract)}
    </div>
  ` : ''}
</div>
<p><br/></p>
`;

  const updatedHtml = existingHtml ? `${existingHtml}${citationCardHtml}` : citationCardHtml;

  // 3. Save updated document via REST
  return await apiRequest(`/api/research/${projectId}/document`, {
    method: 'PUT',
    body: JSON.stringify({ contentHtml: updatedHtml })
  });
}

// ── Security Emergency Incident Methods ───────────────────────────────────────
export async function submitEmergencyIncident(data) {
  return await apiRequest('/api/security/incidents', {
    method: 'POST',
    body: JSON.stringify({
      title: data.title,
      description: data.description,
      location: data.location,
      category: data.category || 'EMERGENCY_SOS',
      isAnonymous: Boolean(data.isAnonymous)
    })
  });
}

// ── Helper ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
