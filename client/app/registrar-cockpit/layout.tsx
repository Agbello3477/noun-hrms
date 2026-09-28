'use client';

import { useState } from 'react';
import Sidebar from '../../components/dashboard/Sidebar';
import Header from '../../components/dashboard/Header';
import { SocketProvider } from '../../context/SocketContext';

function RegistrarCockpitContent({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
                <Header toggleSidebar={() => setIsSidebarOpen(true)} />
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}

export default function RegistrarCockpitLayout({ children }: { children: React.ReactNode }) {
    return (
        <SocketProvider>
            <RegistrarCockpitContent>
                {children}
            </RegistrarCockpitContent>
        </SocketProvider>
    );
}
