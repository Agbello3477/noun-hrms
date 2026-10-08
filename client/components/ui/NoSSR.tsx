"use client";

import React, { useEffect, useState } from 'react';

interface NoSSRProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * Universal Client-Side rendering wrapper.
 * Prevents server-side execution of browser-only APIs and hydration mismatches.
 */
export default function NoSSR({ children, fallback = null }: NoSSRProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return mounted ? <>{children}</> : <>{fallback}</>;
}
