'use client';

import { useState } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { SocketProvider } from '@/context/SocketContext';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

function RegistryContent({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden relative">
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
            
            <div className={`md:hidden fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 flex-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
            </div>

            <div className="hidden md:block flex-none">
                <Sidebar />
            </div>

            <div className="flex flex-1 flex-col overflow-hidden min-w-0">
                <Header toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}

export default function RegistryLayout({ children }: { children: React.ReactNode }) {
    return (
        <SocketProvider>
            <RegistryContent>
                {children}
            </RegistryContent>
        </SocketProvider>
    );
}
