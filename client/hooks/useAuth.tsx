'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import api from '../lib/api';
import { useRouter } from 'next/navigation';


interface User {
    id: string;
    email: string;
    name: string;
    mustChangePassword?: boolean;

    // Phase 3 Enterprise Roles
    role: 'SUPER_USER' | 'HR_ADMIN' | 'UNIT_HEAD' | 'UNIT_ADMIN' | 'BURSARY' | 'AUDIT' | 'STUDY_CENTER_MANAGER' | 'STAFF' | 'ADMIN' | 'VICE_CHANCELLOR';

    staffProfile?: {
        id: string;
        staffId: string | null;
        title?: string | null;
        department: string | null; // Legacy

        // Expanded Organization
        unitId: string | null;
        unit?: {
            id: string;
            name: string;
            type: string;
        };
        centerId: string | null;
        studyCenter?: {
            id: string;
            name: string;
            code: string;
        };

        // Expanded Bio
        rank: string | null;
        level: string | null;
        step: string | null;
        cadre: string | null;
        phone: string | null;
        stateOfOrigin: string | null;
        lga: string | null;
        address: string | null;
        passportUrl: string | null;
        status?: string | null;
        signatureUrl?: string | null;
    };
}

interface AuthContextType {
    user: User | null;
    login: (token: string, user: User) => void;
    logout: (currentPath?: any) => void;
    refreshUser: () => Promise<void>;
    isLoading: boolean;
    keepSessionAlive: () => void;
    showTimeoutWarning: boolean;
    countdownTime: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
    const [countdownTime, setCountdownTime] = useState(60);
    const lastActiveTime = useRef<number>(Date.now());
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const keepSessionAlive = () => {
        lastActiveTime.current = Date.now();
        setShowTimeoutWarning(false);
        setCountdownTime(60);
    };

    const handleActivity = () => {
        if (!showTimeoutWarning) {
            lastActiveTime.current = Date.now();
        }
    };

    useEffect(() => {
        if (user) {
            window.addEventListener('mousemove', handleActivity);
            window.addEventListener('keydown', handleActivity);
            window.addEventListener('click', handleActivity);
            window.addEventListener('scroll', handleActivity);

            lastActiveTime.current = Date.now();

            intervalRef.current = setInterval(() => {
                const idleSeconds = Math.floor((Date.now() - lastActiveTime.current) / 1000);
                
                if (idleSeconds >= 120 && idleSeconds < 180) {
                    setShowTimeoutWarning(true);
                    setCountdownTime(180 - idleSeconds);
                } else if (idleSeconds >= 180) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    setShowTimeoutWarning(false);
                    const currentPath = window.location.pathname;
                    logout(currentPath);
                }
            }, 1000);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('click', handleActivity);
            window.removeEventListener('scroll', handleActivity);
        };
    }, [user, showTimeoutWarning]);

    const fetchUser = async () => {
        if (typeof window === 'undefined') return;
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const { data } = await api.get('/api/auth/me');
                setUser(data);
            } catch (error: any) {
                console.error('Failed to fetch user', error);
                if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                    localStorage.removeItem('token');
                    setUser(null);
                } else {
                    setUser(null);
                }
            }
        }
    };

    useEffect(() => {
        const initializeAuth = async () => {
            await fetchUser();
            setIsLoading(false);
        };

        initializeAuth();

        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                const token = localStorage.getItem('token');
                if (!token) {
                    window.location.replace('/');
                }
            }
        };
        window.addEventListener('pageshow', handlePageShow);
        return () => window.removeEventListener('pageshow', handlePageShow);
    }, []);

    const login = (token: string, userData: User) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('token', token);
        }
        setUser(userData);

        const returnUrl = localStorage.getItem('auth_return_url');
        if (returnUrl) {
            localStorage.removeItem('auth_return_url');
            router.push(returnUrl);
        } else {
            router.push('/dashboard');
        }
    };

    const logout = (currentPath?: any) => {
        if (typeof window !== 'undefined') {
            if (currentPath && typeof currentPath === 'string') {
                localStorage.setItem('auth_return_url', currentPath);
            } else {
                localStorage.removeItem('auth_return_url');
            }

            localStorage.removeItem('token');
            setUser(null);
            window.location.href = '/';
        }
    };

    const refreshUser = async () => {
        await fetchUser();
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            login, 
            logout, 
            refreshUser, 
            isLoading,
            keepSessionAlive,
            showTimeoutWarning,
            countdownTime
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
