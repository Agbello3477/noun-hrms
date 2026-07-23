import axios from 'axios';

const LIVE_API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://noun-hrms.onrender.com').replace(/"/g, '').replace(/'/g, '').trim();

const api = axios.create({
    baseURL: LIVE_API_URL,
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
    const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://noun-hrms.onrender.com';
    const baseUrl = rawBaseUrl.replace(/"/g, '').replace(/'/g, '').trim();
    return `${baseUrl}${cleanUrl}`;
};

export default api;
