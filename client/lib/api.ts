import axios from 'axios';

export const getApiBaseUrl = (): string => {
    let base = (process.env.NEXT_PUBLIC_API_URL || 'https://noun-hrms.onrender.com').replace(/"/g, '').replace(/'/g, '').trim();
    if (typeof window !== 'undefined') {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            const localPort = process.env.NEXT_PUBLIC_PORT || '5000';
            base = `http://localhost:${localPort}`;
        }
    }
    return base;
};

export const getSocketUrl = (): string => {
    return getApiBaseUrl();
};

const api = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: 60000, // 60s timeout to accommodate Render cold-starts and slow connections
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to attach JWT token from current tab's sessionStorage
api.interceptors.request.use(
    (config) => {
        if (typeof window !== 'undefined') {
            const token = sessionStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor to handle auto-retry on temporary network timeouts/cold-starts
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config;
        // Retry once if error is network or timeout (ECONNABORTED) and hasn't been retried yet
        if (error.code === 'ECONNABORTED' && config && !config._retry) {
            config._retry = true;
            console.log('[API] Connection timed out (server waking up). Retrying request...');
            return api(config);
        }
        return Promise.reject(error);
    }
);

// Non-blocking pre-flight API warming probe to wake up Render instance
export const warmupBackendApi = (): void => {
    if (typeof window !== 'undefined') {
        fetch(`${getApiBaseUrl()}/healthz`, { method: 'GET', mode: 'cors' }).catch(() => {
            // Silent warming attempt
        });
    }
};

// Trigger instant warmup on client script load
if (typeof window !== 'undefined') {
    setTimeout(warmupBackendApi, 50);
}

export const getImageUrl = (url: string | null | undefined): string => {
    if (!url) return '';
    const trimmed = String(url).trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed;
    
    const cleanUrl = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    
    let base = (process.env.NEXT_PUBLIC_API_URL || 'https://noun-hrms.onrender.com').replace(/"/g, '').replace(/'/g, '').trim();
    if (typeof window !== 'undefined') {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            const localPort = process.env.NEXT_PUBLIC_PORT || '5000';
            base = `http://localhost:${localPort}`;
        }
    }
    base = base.replace(/\/+$/, '');
    return `${base}${cleanUrl}`;
};

export default api;
