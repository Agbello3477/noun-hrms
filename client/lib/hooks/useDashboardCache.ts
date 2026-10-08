'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * useSessionCache<T>
 * Instantly returns cached data from sessionStorage (0ms perceived load),
 * then refreshes in the background only if the cache has expired.
 */
export function useSessionCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL,
  enabled: boolean = true
): { data: T | null; loading: boolean; refresh: () => Promise<void> } {
  const [data, setData] = useState<T | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { value } = JSON.parse(raw);
      return value as T;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState<boolean>(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const doFetch = useCallback(
    async (silent = false) => {
      if (!enabled) return;
      if (!silent) setLoading(true);
      try {
        const result = await fetcherRef.current();
        setData(result);
        try {
          sessionStorage.setItem(key, JSON.stringify({ value: result, ts: Date.now() }));
        } catch {}
      } catch (err) {
        if (!silent) console.error(`[useSessionCache] fetch error for key "${key}":`, err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [key, enabled]
  );

  useEffect(() => {
    if (!enabled) return;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const { ts } = JSON.parse(raw);
        const age = Date.now() - (ts || 0);
        if (age < ttlMs) {
          const remaining = ttlMs - age;
          const timer = setTimeout(() => doFetch(true), remaining);
          return () => clearTimeout(timer);
        }
      }
    } catch {}
    doFetch(false);
  }, [key, ttlMs, enabled, doFetch]);

  return { data, loading, refresh: () => doFetch(false) };
}
