'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';

// In-Memory global cache map for instant 0ms retrieval
const memoryCache = new Map<string, { data: any; timestamp: number }>();

interface SwrOptions<T> {
  initialData?: T;
  revalidateOnFocus?: boolean;
  revalidateInterval?: number; // ms
  ttl?: number; // Time to live in ms (default 3 minutes)
  sessionPersist?: boolean;
}

interface SwrReturn<T> {
  data: T | undefined;
  error: any;
  isLoading: boolean;
  isValidating: boolean;
  mutate: (newData?: T, shouldRevalidate?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSwrData<T = any>(
  key: string | null,
  options: SwrOptions<T> = {}
): SwrReturn<T> {
  const {
    initialData,
    revalidateOnFocus = true,
    revalidateInterval = 0,
    ttl = 180000, // 3 minutes
    sessionPersist = true
  } = options;

  // Retrieve cached value immediately for 0ms initial render
  const getCachedValue = (): T | undefined => {
    if (!key) return initialData;

    // 1. Check in-memory cache
    const inMem = memoryCache.get(key);
    if (inMem && Date.now() - inMem.timestamp < ttl) {
      return inMem.data as T;
    }

    // 2. Check sessionStorage
    if (sessionPersist && typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(`swr_cache_${key}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Date.now() - parsed.timestamp < ttl) {
            memoryCache.set(key, parsed);
            return parsed.data as T;
          }
        }
      } catch {
        // Ignore session parse errors
      }
    }

    return inMem ? (inMem.data as T) : initialData;
  };

  const [data, setData] = useState<T | undefined>(getCachedValue);
  const [error, setError] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => !getCachedValue());
  const [isValidating, setIsValidating] = useState<boolean>(false);

  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!key) return;

    setIsValidating(true);
    try {
      const response = await api.get(key);
      const fetchedData = response.data;

      const cacheEntry = { data: fetchedData, timestamp: Date.now() };
      memoryCache.set(key, cacheEntry);

      if (sessionPersist && typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(`swr_cache_${key}`, JSON.stringify(cacheEntry));
        } catch {
          // Quota exceeded or private browsing
        }
      }

      if (mountedRef.current) {
        setData(fetchedData);
        setError(null);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err);
        setIsLoading(false);
      }
    } finally {
      if (mountedRef.current) {
        setIsValidating(false);
      }
    }
  }, [key, sessionPersist]);

  useEffect(() => {
    mountedRef.current = true;

    if (!key) {
      setIsLoading(false);
      return;
    }

    const cached = getCachedValue();
    if (cached !== undefined) {
      setData(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    // Always fetch/revalidate fresh data
    fetchData();

    return () => {
      mountedRef.current = false;
    };
  }, [key, fetchData]);

  // Revalidate on Window Focus
  useEffect(() => {
    if (!revalidateOnFocus || !key) return;

    const handleFocus = () => {
      if (!document.hidden) {
        fetchData();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [key, revalidateOnFocus, fetchData]);

  // Optional Polling
  useEffect(() => {
    if (!revalidateInterval || revalidateInterval <= 0 || !key) return;

    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchData();
      }
    }, revalidateInterval);

    return () => clearInterval(interval);
  }, [key, revalidateInterval, fetchData]);

  const mutate = useCallback(
    async (newData?: T, shouldRevalidate = true) => {
      if (newData !== undefined) {
        setData(newData);
        if (key) {
          const entry = { data: newData, timestamp: Date.now() };
          memoryCache.set(key, entry);
          if (sessionPersist && typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(`swr_cache_${key}`, JSON.stringify(entry));
            } catch {}
          }
        }
      }
      if (shouldRevalidate) {
        await fetchData();
      }
    },
    [key, sessionPersist, fetchData]
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    refresh: fetchData
  };
}
