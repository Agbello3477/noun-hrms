"use client";

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavigationProgress() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isNavigating, setIsNavigating] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        // Reset navigation progress when path or query changes
        setIsNavigating(false);
        setProgress(100);
        const timer = setTimeout(() => setProgress(0), 200);
        return () => clearTimeout(timer);
    }, [pathname, searchParams]);

    useEffect(() => {
        // Listen to link clicks for instant top loading feedback
        const handleLinkClick = (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('a');
            if (target && target.href && target.href.startsWith(window.location.origin)) {
                const url = new URL(target.href);
                if (url.pathname !== window.location.pathname || url.search !== window.location.search) {
                    setIsNavigating(true);
                    setProgress(30);
                }
            }
        };

        window.addEventListener('click', handleLinkClick);
        return () => window.removeEventListener('click', handleLinkClick);
    }, []);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isNavigating && progress < 90) {
            interval = setInterval(() => {
                setProgress((prev) => (prev >= 90 ? 90 : prev + 15));
            }, 100);
        }
        return () => clearInterval(interval);
    }, [isNavigating, progress]);

    if (progress === 0) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-1 w-full bg-emerald-100/50 pointer-events-none">
            <div
                className="h-full bg-emerald-600 transition-all duration-200 ease-out shadow-[0_0_10px_#059669]"
                style={{ width: `${progress}%` }}
            />
        </div>
    );
}
