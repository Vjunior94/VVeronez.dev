import { useState, useEffect, useRef } from 'react';

/**
 * Shows cached data instantly from sessionStorage, then refreshes in background.
 * Returns [data, loading] where loading is only true on first ever load (no cache).
 * Uses useEffect to read cache to avoid SSR hydration mismatch.
 */
export function useCachedFetch<T>(key: string, fetcher: () => Promise<T>): [T | null, boolean] {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    // Read cache on mount (client only — avoids hydration mismatch)
    try {
      const cached = sessionStorage.getItem(`cache:${key}`);
      if (cached) {
        setData(JSON.parse(cached));
        setLoading(false);
      }
    } catch {}

    // Fetch fresh data in background
    let cancelled = false;
    fetcherRef.current().then(result => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
      try { sessionStorage.setItem(`cache:${key}`, JSON.stringify(result)); } catch {}
    });
    return () => { cancelled = true; };
  }, [key]);

  return [data, loading];
}
