'use client';

import { useState, useEffect, useCallback } from 'react';

export interface UserLocationState {
  state: string;
  country: string;
  formattedLocation: string;
  statusText: string;
  isLoading: boolean;
  isError: boolean;
  source: 'gps' | 'ip' | 'fallback' | 'cached';
  requestPreciseLocation: () => Promise<void>;
}

interface StoredLocation {
  state: string;
  country: string;
  formatted: string;
  source: 'gps' | 'ip' | 'fallback';
  timestamp?: number;
}

const STORAGE_KEY = 'user_geo_location';
const DEFAULT_FALLBACK_STATE = 'Campus Network';
const DEFAULT_FALLBACK_COUNTRY = 'Nigeria';

function cleanStateName(rawState?: string, city?: string): string {
  if (!rawState) return city ? city.trim() : '';
  let s = rawState.trim();
  if (/federal capital territory/i.test(s)) return 'Abuja';
  s = s.replace(/\s+(State|state|Province|province|Region|region)$/i, '');
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
  // 1. Primary reverse geocoder: BigDataCloud client API (free, fast, keyless)
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
  } catch (e) {
    // Ignore and proceed to fallback
  }

  // 2. Fallback reverse geocoder: OpenStreetMap Nominatim
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
  } catch (e) {
    // Ignore
  }

  return null;
}

async function resolveIpLocation(signal?: AbortSignal): Promise<{ state: string; country: string } | null> {
  // 1. Primary: ipapi.co
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

  // 2. Fallback: ipwho.is
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

  // 3. Fallback: api.country.is
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
  const [locationData, setLocationData] = useState<StoredLocation | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.formatted) {
            return parsed;
          }
        }
      } catch (e) {}
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(!locationData);
  const [isError, setIsError] = useState<boolean>(false);

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

  // Precise device/GPS location request (can be triggered by user gesture or permission query)
  const requestPreciseLocation = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return;
    }

    setIsLoading(true);

    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const geo = await reverseGeocode(latitude, longitude);
            if (geo && geo.state) {
              applyLocation(geo.state, geo.country, 'gps');
              resolve();
              return;
            }
          } catch (e) {}

          // Fallback if reverse geocoding failed
          resolve();
        },
        (error) => {
          // Geolocation permission denied or timed out
          resolve();
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 60000
        }
      );
    });
  }, [applyLocation]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const resolveInitialLocation = async () => {
      // 1. If we already have GPS-verified location cached, don't re-fetch
      if (locationData && locationData.source === 'gps') {
        setIsLoading(false);
        return;
      }

      // 2. Check if browser has Geolocation permission granted
      if (typeof window !== 'undefined' && navigator.geolocation) {
        // Attempt quick non-blocking GPS lookup
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            if (!isMounted) return;
            try {
              const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude, controller.signal);
              if (geo && isMounted) {
                applyLocation(geo.state, geo.country, 'gps');
                return;
              }
            } catch (e) {}
          },
          async () => {
            // If GPS denied/unavailable and we don't have cached data, resolve via IP
            if (!isMounted) return;
            if (!locationData) {
              const ipLoc = await resolveIpLocation(controller.signal);
              if (ipLoc && isMounted) {
                applyLocation(ipLoc.state, ipLoc.country, 'ip');
              } else if (isMounted) {
                applyLocation(DEFAULT_FALLBACK_STATE, DEFAULT_FALLBACK_COUNTRY, 'fallback');
              }
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 3000,
            maximumAge: 120000
          }
        );
      }

      // 3. Simultaneously resolve IP geolocation as fast baseline if nothing is loaded yet
      if (!locationData) {
        try {
          const ipLoc = await resolveIpLocation(controller.signal);
          if (ipLoc && isMounted) {
            // Apply IP location as baseline
            applyLocation(ipLoc.state, ipLoc.country, 'ip');
          } else if (isMounted && !locationData) {
            applyLocation(DEFAULT_FALLBACK_STATE, DEFAULT_FALLBACK_COUNTRY, 'fallback');
          }
        } catch (err) {
          if (isMounted && !locationData) {
            setIsError(true);
            applyLocation(DEFAULT_FALLBACK_STATE, DEFAULT_FALLBACK_COUNTRY, 'fallback');
          }
        }
      }
    };

    resolveInitialLocation();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [applyLocation, locationData]);

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
    requestPreciseLocation
  };
}
