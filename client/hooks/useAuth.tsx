'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import api from '../lib/api';
import { useRouter } from 'next/navigation';


interface User {
    id: string;
    email: string;
    name: string;

    // Phase 3 Enterprise Roles
    role: 'SUPER_USER' | 'HR_ADMIN' | 'UNIT_HEAD' | 'UNIT_ADMIN' | 'BURSARY' | 'AUDIT' | 'STUDY_CENTER_MANAGER' | 'STAFF' | 'ADMIN';

    staffProfile?: {
        id: string;
        staffId: string | null;
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
    };
}

interface AuthContextType {
    user: User | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    refreshUser: () => Promise<void>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    let idleTimer: NodeJS.Timeout;

    const TIMEOUT_MS = 3 * 60 * 1000; // 3 Minutes


    const handleActivity = () => {
        resetTimer();
    };

    useEffect(() => {
        if (user) {
            // Attach listeners
            window.addEventListener('mousemove', handleActivity);
            window.addEventListener('keydown', handleActivity);
            window.addEventListener('click', handleActivity);

            resetTimer(); // Start timer
        }

        return () => {
            if (idleTimer) clearTimeout(idleTimer);
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('click', handleActivity);
        };
    }, [user]);

    const fetchUser = async () => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const { data } = await api.get('/api/auth/me');
                setUser(data);
            } catch (error) {
                console.error('Failed to fetch user', error);
                localStorage.removeItem('token');
                setUser(null);
            }
        }
    };

    useEffect(() => {
        const initializeAuth = async () => {
            await fetchUser();
            setIsLoading(false);
        };

        initializeAuth();
    }, []);

    const login = (token: string, userData: User) => {
        localStorage.setItem('token', token);
        setUser(userData);

        // Redirect logic
        const returnUrl = localStorage.getItem('auth_return_url');
        if (returnUrl) {
            localStorage.removeItem('auth_return_url');
            router.push(returnUrl);
        } else {
            router.push('/dashboard');
        }
    };

    const logout = (currentPath?: string) => {
        // If logout is triggered by timeout/system (passed path), save it.
        // If manual (no path passed or explicit null), clear it? 
        // User request: "when session timeout always return to homepage... when log back in pick on from where he was logged out"
        // So for TIMEOUT, we save path. For MANUAL logout, we probably shouldn't? 
        // "When logout always return to homepage... when starting the system it should always start from homepage."

        if (currentPath) {
            localStorage.setItem('auth_return_url', currentPath);
        } else {
            localStorage.removeItem('auth_return_url');
        }

        localStorage.removeItem('token');
        setUser(null);
        router.push('/'); // Always return to homepage
    };

    const resetTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        if (user) {
            idleTimer = setTimeout(() => {
                console.log('Session timed out due to inactivity');
                // Save current path before logging out
                const currentPath = window.location.pathname;
                logout(currentPath);
                alert('Session timed out due to inactivity (3 minutes). Please log in again to resume.');
            }, TIMEOUT_MS);
        }
    };

    const refreshUser = async () => {
        await fetchUser();
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, refreshUser, isLoading }}>
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
