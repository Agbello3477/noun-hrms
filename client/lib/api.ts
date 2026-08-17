import axios from 'axios';

const LIVE_API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://noun-hrms.onrender.com').replace(/"/g, '').replace(/'/g, '').trim();

let apiBaseUrl = LIVE_API_URL;
if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const localPort = process.env.NEXT_PUBLIC_PORT || '5000';
        apiBaseUrl = `http://localhost:${localPort}`;
    }
}

const api = axios.create({
    baseURL: apiBaseUrl,
    timeout: 60000, // 60s timeout to accommodate Render cold-starts and slow connections
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
    (config) => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('token');
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
        fetch(`${apiBaseUrl}/healthz`, { method: 'GET', mode: 'cors' }).catch(() => {
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
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    
    let base = (process.env.NEXT_PUBLIC_API_URL || 'https://noun-hrms.onrender.com').replace(/"/g, '').replace(/'/g, '').trim();
    if (typeof window !== 'undefined') {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            base = 'http://localhost:5000';
        }
    }
    return `${base}${cleanUrl}`;
};

export default api;
