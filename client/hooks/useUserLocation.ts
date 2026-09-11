'use client';

import { useState, useEffect } from 'react';

export interface UserLocationState {
  state: string;
  country: string;
  formattedLocation: string;
  statusText: string;
  isLoading: boolean;
  isError: boolean;
}

const STORAGE_KEY = 'user_geo_location';
const DEFAULT_FALLBACK_STATE = 'Campus Network';
const DEFAULT_FALLBACK_COUNTRY = 'Nigeria';

export function useUserLocation(): UserLocationState {
  const [locationData, setLocationData] = useState<{ state: string; country: string; formatted: string } | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.formatted) {
            return parsed;
          }
        }
      } catch (e) {
        // Ignore parsing or storage access errors
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(!locationData);
  const [isError, setIsError] = useState<boolean>(false);

  useEffect(() => {
    if (locationData) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // Strict 2-second timeout

    const resolveLocation = async () => {
      try {
        // Primary Endpoint: ipapi.co
        let res = await fetch('https://ipapi.co/json/', {
          signal: controller.signal,
          headers: { Accept: 'application/json' }
        }).catch(() => null);

        let data: any = null;

        if (res && res.ok) {
          data = await res.json().catch(() => null);
        }

        // Fallback 1: ipwho.is if primary fails or is rate limited
        if (!data || data.error || (!data.country_name && !data.country)) {
          res = await fetch('https://ipwho.is/', {
            signal: controller.signal,
            headers: { Accept: 'application/json' }
          }).catch(() => null);

          if (res && res.ok) {
            data = await res.json().catch(() => null);
          }
        }

        // Fallback 2: api.country.is
        if (!data || (!data.country_name && !data.country)) {
          res = await fetch('https://api.country.is/', {
            signal: controller.signal,
            headers: { Accept: 'application/json' }
          }).catch(() => null);

          if (res && res.ok) {
            data = await res.json().catch(() => null);
          }
        }

        if (isMounted) {
          clearTimeout(timeoutId);

          let state = data?.region || data?.regionName || data?.city || data?.state || '';
          let country = data?.country_name || data?.country || '';

          // Normalize ISO country codes to proper names
          if (country === 'NG') country = 'Nigeria';
          else if (country === 'GB' || country === 'UK') country = 'United Kingdom';
          else if (country === 'US') country = 'United States';
          else if (country === 'CA') country = 'Canada';
          else if (country === 'GH') country = 'Ghana';
          else if (country === 'KE') country = 'Kenya';
          else if (country === 'ZA') country = 'South Africa';

          if (!state && country) {
            state = 'Abuja';
          } else if (!state && !country) {
            state = DEFAULT_FALLBACK_STATE;
            country = DEFAULT_FALLBACK_COUNTRY;
          }

          const formatted = country ? `${state}, ${country}` : state;
          const result = { state, country, formatted };

          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
            } catch (e) {}
          }

          setLocationData(result);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          clearTimeout(timeoutId);
          setIsError(true);
          const fallback = {
            state: DEFAULT_FALLBACK_STATE,
            country: DEFAULT_FALLBACK_COUNTRY,
            formatted: `${DEFAULT_FALLBACK_STATE}, ${DEFAULT_FALLBACK_COUNTRY}`
          };
          setLocationData(fallback);
          setIsLoading(false);
        }
      }
    };

    resolveLocation();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [locationData]);

  const state = locationData?.state || (isLoading ? 'Detecting Node...' : DEFAULT_FALLBACK_STATE);
  const country = locationData?.country || '';
  const formattedLocation = locationData?.formatted || (isLoading ? 'Detecting Node...' : `${DEFAULT_FALLBACK_STATE}, ${DEFAULT_FALLBACK_COUNTRY}`);
  const statusText = `${formattedLocation} • Online`;

  return {
    state,
    country,
    formattedLocation,
    statusText,
    isLoading,
    isError
  };
}
