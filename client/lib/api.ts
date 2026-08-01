import axios from 'axios';

const LIVE_API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://noun-hrms.onrender.com').replace(/"/g, '').replace(/'/g, '').trim();

let apiBaseUrl = LIVE_API_URL;
if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        apiBaseUrl = 'http://localhost:5000';
    }
}

const api = axios.create({
    baseURL: apiBaseUrl,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

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
