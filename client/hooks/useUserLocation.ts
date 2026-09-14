'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UserLocationState {
  state: string;
  country: string;
  formattedLocation: string;
  statusText: string;
  isLoading: boolean;
  isError: boolean;
  source: 'gps' | 'ip' | 'fallback';
  requestPreciseLocation: () => Promise<void>;
  refreshLocation: () => Promise<void>;
}

interface StoredLocation {
  state: string;
  country: string;
  formatted: string;
  source: 'gps' | 'ip' | 'fallback';
  timestamp: number;
}

const STORAGE_KEY = 'user_geo_location_v2';
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache lifetime
const DEFAULT_FALLBACK_STATE = 'Campus Network';
const DEFAULT_FALLBACK_COUNTRY = 'Nigeria';

function cleanStateName(rawState?: string, city?: string): string {
  if (!rawState && !city) return '';
  let s = (rawState || city || '').trim();
  if (/federal capital territory|fct|abuja/i.test(s)) return 'Abuja';
  s = s.replace(/\s+(State|state|Province|province|Region|region)$/i, '').trim();
  return s || (city ? city.trim() : '');
}

function cleanCountryName(country?: string): string {
  if (!country) return '';
  let c = country.trim();
  if (c === 'NG' || /nigeria/i.test(c)) return 'Nigeria';
  if (c === 'GB' || c === 'UK' || /united kingdom/i.test(c)) return 'United Kingdom';
  if (c === 'US' || /united states/i.test(c)) return 'United States';
  if (c === 'CA' || /canada/i.test(c)) return 'Canada';
  if (c === 'GH' || /ghana/i.test(c)) return 'Ghana';
  if (c === 'KE' || /kenya/i.test(c)) return 'Kenya';
  if (c === 'ZA' || /south africa/i.test(c)) return 'South Africa';
  return c;
}

async function reverseGeocode(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<{ state: string; country: string } | null> {
  // 1. Primary: BigDataCloud client reverse geocode API (free, fast, keyless)
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      { signal, headers: { Accept: 'application/json' } }
    ).catch(() => null);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data) {
        const rawState = data.principalSubdivision || data.city || data.locality || '';
        const rawCountry = data.countryName || data.countryCode || '';
        const state = cleanStateName(rawState, data.city);
        const country = cleanCountryName(rawCountry);
        if (state && country) {
          return { state, country };
        }
      }
    }
  } catch (e) {}

  // 2. Fallback: OpenStreetMap Nominatim
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      { signal, headers: { Accept: 'application/json' } }
    ).catch(() => null);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.address) {
        const rawState = data.address.state || data.address.county || data.address.city || '';
        const rawCountry = data.address.country || data.address.country_code || '';
        const state = cleanStateName(rawState, data.address.city);
        const country = cleanCountryName(rawCountry);
        if (state && country) {
          return { state, country };
        }
      }
    }
  } catch (e) {}

  return null;
}

async function resolveLiveIpLocation(signal?: AbortSignal): Promise<{ state: string; country: string } | null> {
  // 1. Primary: ipwho.is (fast, highly accurate regional mapping)
  try {
    const res = await fetch('https://ipwho.is/', {
      signal,
      headers: { Accept: 'application/json' }
    }).catch(() => null);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success !== false && (data.region || data.city || data.country)) {
        const state = cleanStateName(data.region || data.city || '', data.city);
        const country = cleanCountryName(data.country || data.country_code || '');
        if (state || country) {
          return { state: state || 'Abuja', country: country || 'Nigeria' };
        }
      }
    }
  } catch (e) {}

  // 2. Secondary: api.db-ip.com
  try {
    const res = await fetch('https://api.db-ip.com/v2/free/self', {
      signal,
      headers: { Accept: 'application/json' }
    }).catch(() => null);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && (data.stateProv || data.city || data.countryName)) {
        const state = cleanStateName(data.stateProv || data.city || '', data.city);
        const country = cleanCountryName(data.countryName || data.countryCode || '');
        if (state || country) {
          return { state: state || 'Abuja', country: country || 'Nigeria' };
        }
      }
    }
  } catch (e) {}

  // 3. Fallback: ipapi.co
  try {
    const res = await fetch('https://ipapi.co/json/', {
      signal,
      headers: { Accept: 'application/json' }
    }).catch(() => null);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && !data.error && (data.region || data.city || data.country_name)) {
        const state = cleanStateName(data.region || data.city || '', data.city);
        const country = cleanCountryName(data.country_name || data.country || '');
        if (state || country) {
          return { state: state || 'Abuja', country: country || 'Nigeria' };
        }
      }
    }
  } catch (e) {}

  // 4. Fallback: api.country.is
  try {
    const res = await fetch('https://api.country.is/', {
      signal,
      headers: { Accept: 'application/json' }
    }).catch(() => null);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.country) {
        return { state: 'Abuja', country: cleanCountryName(data.country) };
      }
    }
  } catch (e) {}

  return null;
}

export function useUserLocation(): UserLocationState {
  // Synchronous optimistic initialization from sessionStorage if fresh (< 3 mins old)
  const [locationData, setLocationData] = useState<StoredLocation | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as StoredLocation;
          if (parsed && parsed.formatted && parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL_MS) {
            return parsed;
          }
        }
      } catch (e) {}
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(!locationData);
  const [isError, setIsError] = useState<boolean>(false);
  const isGpsResolvedRef = useRef<boolean>(false);

  // Helper to persist and update location state
  const applyLocation = useCallback((state: string, country: string, source: 'gps' | 'ip' | 'fallback') => {
    const formatted = country ? `${state}, ${country}` : state;
    const result: StoredLocation = {
      state,
      country,
      formatted,
      source,
      timestamp: Date.now()
    };

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      } catch (e) {}
    }

    setLocationData(result);
    setIsLoading(false);
  }, []);

  // Force a live, fresh location detection using device GPS coordinates
  const requestPreciseLocation = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined') return;

    setIsLoading(true);
    isGpsResolvedRef.current = false;

    if (!navigator.geolocation) {
      // If GPS unsupported, re-run live IP lookup
      const ipLoc = await resolveLiveIpLocation();
      if (ipLoc) {
        applyLocation(ipLoc.state, ipLoc.country, 'ip');
      }
      setIsLoading(false);
      return;
    }

    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const geo = await reverseGeocode(latitude, longitude);
            if (geo && geo.state) {
              isGpsResolvedRef.current = true;
              applyLocation(geo.state, geo.country, 'gps');
              resolve();
              return;
            }
          } catch (e) {}

          // If reverse geocoding failed, fallback to live IP
          const ipLoc = await resolveLiveIpLocation();
          if (ipLoc) {
            applyLocation(ipLoc.state, ipLoc.country, 'ip');
          }
          resolve();
        },
        async () => {
          // If user denies GPS or it times out, fallback to live IP
          const ipLoc = await resolveLiveIpLocation();
          if (ipLoc) {
            applyLocation(ipLoc.state, ipLoc.country, 'ip');
          }
          resolve();
        },
        {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 0 // Always force fresh hardware sensor position
        }
      );
    });
  }, [applyLocation]);

  // Unconditional live revalidation on every page mount
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const revalidateLocation = async () => {
      // 1. Attempt non-blocking real-time device GPS lookup with maximumAge: 0
      if (typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            if (!isMounted) return;
            try {
              const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude, controller.signal);
              if (geo && isMounted) {
                isGpsResolvedRef.current = true;
                applyLocation(geo.state, geo.country, 'gps');
                return;
              }
            } catch (e) {}
          },
          () => {
            // Geolocation not granted or unavailable; IP fallback handles it
          },
          {
            enableHighAccuracy: true,
            timeout: 3500,
            maximumAge: 0 // Do NOT accept stale GPS positions
          }
        );
      }

      // 2. Concurrently fetch fresh live IP location
      try {
        const ipLoc = await resolveLiveIpLocation(controller.signal);
        if (ipLoc && isMounted && !isGpsResolvedRef.current) {
          applyLocation(ipLoc.state, ipLoc.country, 'ip');
        } else if (isMounted && !locationData && !isGpsResolvedRef.current) {
          applyLocation(DEFAULT_FALLBACK_STATE, DEFAULT_FALLBACK_COUNTRY, 'fallback');
        }
      } catch (err) {
        if (isMounted && !locationData && !isGpsResolvedRef.current) {
          setIsError(true);
          applyLocation(DEFAULT_FALLBACK_STATE, DEFAULT_FALLBACK_COUNTRY, 'fallback');
        }
      }
    };

    revalidateLocation();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [applyLocation]); // Runs unconditionally on mount

  const state = locationData?.state || (isLoading ? 'Detecting Node...' : DEFAULT_FALLBACK_STATE);
  const country = locationData?.country || '';
  const formattedLocation = locationData?.formatted || (isLoading ? 'Detecting Node...' : `${DEFAULT_FALLBACK_STATE}, ${DEFAULT_FALLBACK_COUNTRY}`);
  const statusText = `${formattedLocation} • Online`;
  const source = locationData?.source || 'fallback';

  return {
    state,
    country,
    formattedLocation,
    statusText,
    isLoading,
    isError,
    source,
    requestPreciseLocation,
    refreshLocation: requestPreciseLocation
  };
}
