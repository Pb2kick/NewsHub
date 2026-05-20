import { useEffect, useMemo, useState } from 'react';
import { fetchNewsByLocation } from '../services/newsApi';
import {
  APPROXIMATE_LOCAL_LABEL,
  LOCATION_OPTIONS,
  LOCATION_STORAGE_KEY,
  USER_LOCATION_CURRENT,
  USER_LOCATION_STORAGE_KEY,
} from '../../shared/constants/locations';
import { resolveLocationDetails, toValidLocationMode } from '../../shared/utils/locationResolver';

/**
 * Returns default location details for unsupported geolocation scenarios.
 *
 * BUG 7 FIX: was 'Metro District' / 'Philippines' — hardcoded PH defaults caused every
 * new user without a stored location to seed the DB with Philippines-tagged articles and
 * contaminate the International pool for PH users.
 * Blank country/area is the safe sentinel: the backend returns List.of() for blank country,
 * and the loadLocationNews() guard (Fix 5e below) prevents a blank-country fetch from firing.
 *
 * @returns {{ area: string, country: string, label: string, latitude: number | null, longitude: number | null }}
 */
function fallbackUserLocation() {
  return {
    area: '',     // was 'Metro District' — blank signals unresolved state
    country: '',  // was 'Philippines'    — blank prevents PH-scoped DB seeding
    label: APPROXIMATE_LOCAL_LABEL, // now 'Location not yet resolved' (BUG 7 FIX)
    latitude: null,
    longitude: null,
  };
}

/**
 * Parses and validates a manually saved location payload.
 * @returns {{ area: string, country: string, label: string, latitude: number | null, longitude: number | null } | null}
 */
function getStoredManualLocation() {
  const raw = window.localStorage.getItem(USER_LOCATION_STORAGE_KEY);
  if (!raw || raw === USER_LOCATION_CURRENT) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.area || !parsed?.country || !parsed?.label) {
      return null;
    }
    return {
      area: String(parsed.area),
      country: String(parsed.country),
      label: String(parsed.label),
      latitude: typeof parsed.latitude === 'number' ? parsed.latitude : null,
      longitude: typeof parsed.longitude === 'number' ? parsed.longitude : null,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves and persists user base location plus selected news filter mode.
 * @returns {{
 * selectedLocation: string,
 * locationLabel: string,
 * isDetecting: boolean,
 * locationError: string,
 * newsArticles: Array,
 * isNewsLoading: boolean,
 * newsError: string,
 * setSelectedLocation: (location: string) => void,
 * setUserLocationFromSearch: (details: { area: string, country: string, label: string, latitude: number | null, longitude: number | null }) => void,
 * useCurrentUserLocation: () => void,
 * userLocationDisplayLabel: string,
 * isUsingCurrentLocation: boolean
 * }}
 */
export function useLocationNews() {
  const storedManualLocation = getStoredManualLocation();
  const [selectedLocation, setSelectedLocationState] = useState(() => {
    const stored = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    return toValidLocationMode(stored, LOCATION_OPTIONS);
  });
  const [isUsingCurrentLocation, setIsUsingCurrentLocation] = useState(() => !storedManualLocation);
  const [locationLabel, setLocationLabel] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [userLocationDetails, setUserLocationDetails] = useState(storedManualLocation || fallbackUserLocation());
  const [newsArticles, setNewsArticles] = useState([]);
  const [isNewsLoading, setIsNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState('');
  // BUG 5e FIX: tracks whether we're waiting for the user's location to resolve.
  // While true the news skeleton stays visible (showInitialNewsLoading = isNewsLoading && articles===0
  // would collapse to false if we set isNewsLoading=false on a blank-country early return).
  const [isLocationPending, setIsLocationPending] = useState(
    // Pending if initial location details are blank (GPS hasn't resolved yet).
    !storedManualLocation && !userLocationDetails.country
  );
  // Pagination state
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  /**
   * Updates selected scope mode and persists it.
   * @param {string} nextLocation
   */
  const setSelectedLocation = (nextLocation) => {
    const valid = toValidLocationMode(nextLocation, LOCATION_OPTIONS);
    window.localStorage.setItem(LOCATION_STORAGE_KEY, valid);
    setSelectedLocationState(valid);
  };

  /**
   * Sets manual user location from a searched suggestion.
   * @param {{ area: string, country: string, label: string, latitude: number | null, longitude: number | null }} details
   */
  const setUserLocationFromSearch = (details) => {
    setIsUsingCurrentLocation(false);
    setLocationError('');
    setUserLocationDetails(details);
    window.localStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(details));
  };

  /** Switches user location mode back to browser geolocation. */
  const useCurrentUserLocation = () => {
    setIsUsingCurrentLocation(true);
    window.localStorage.setItem(USER_LOCATION_STORAGE_KEY, USER_LOCATION_CURRENT);
  };

  useEffect(() => {
    if (!isUsingCurrentLocation) {
      setIsDetecting(false);
      return;
    }

    const abortController = new AbortController();
    if (!navigator.geolocation) {
      setUserLocationDetails(fallbackUserLocation());
      setLocationError('Geolocation not supported. Using approximate location.');
      setIsDetecting(false);
      return () => abortController.abort();
    }

    setIsDetecting(true);
    setLocationError('');

    /*
     * Changes to this geolocation block:
     * 1. GPS and IP resolve in parallel; first non-null result wins.
     * 2. GPS timeout reduced to 10000 ms.
     * 3. Nominatim uses a separate AbortController so cleanup does not cancel it.
     */
    const ipPromise = (async () => {
      try {
        const baseUrl = process.env.REACT_APP_NEWS_API_BASE_URL || 'http://localhost:8080';
        const res = await fetch(`${baseUrl}/api/location/detect`, {
          signal: abortController.signal,
        });
        if (!res.ok) return null;
        const ip = await res.json();
        const area = ip.area || '';
        const country = ip.country || '';
        if (!area || !country) return null;
        return {
          area,
          country,
          label: `${area}, ${country}`,
          latitude: typeof ip.latitude === 'number' ? ip.latitude : null,
          longitude: typeof ip.longitude === 'number' ? ip.longitude : null,
        };
      } catch {
        return null;
      }
    })();

    const gpsPromise = new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const nominatimAbort = new AbortController();
          try {
            const details = await resolveLocationDetails(latitude, longitude, nominatimAbort.signal);
            resolve(details);
          } catch {
            resolve(null);
          }
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
      );
    });

    let firstResult = null;
    let hasResolved = false;
    const acceptResult = (result) => {
      if (hasResolved || !result || abortController.signal.aborted) return;
      hasResolved = true;
      firstResult = result;
      setUserLocationDetails(result);
      setLocationError('');
      setIsDetecting(false);
    };

    ipPromise.then(acceptResult).catch(() => {});
    gpsPromise.then(acceptResult).catch(() => {});

    gpsPromise
      .then((result) => {
        if (!result || abortController.signal.aborted) return;
        if (
          !firstResult ||
          result.label !== firstResult.label ||
          result.latitude !== firstResult.latitude ||
          result.longitude !== firstResult.longitude
        ) {
          setUserLocationDetails(result);
          setLocationError('');
        }
        setIsDetecting(false);
      })
      .catch(() => {});

    Promise.allSettled([ipPromise, gpsPromise]).then(() => {
      if (hasResolved || abortController.signal.aborted) return;
      setUserLocationDetails(fallbackUserLocation());
      setLocationError(
        'Could not detect location automatically. ' +
        'Search for your city using the search box.'
      );
      setIsDetecting(false);
    });

    return () => abortController.abort();
  }, [isUsingCurrentLocation]);

  useEffect(() => {
    setLocationLabel(userLocationDetails.label);
  }, [userLocationDetails]);

  const locationRequest = useMemo(
    () => ({
      location: selectedLocation,
      latitude: selectedLocation === 'Local' ? userLocationDetails.latitude : null,
      longitude: selectedLocation === 'Local' ? userLocationDetails.longitude : null,
      country: userLocationDetails.country,
      area: userLocationDetails.area,
    }),
    [selectedLocation, userLocationDetails]
  );

  useEffect(() => {
    const abortController = new AbortController();

    /** Initial page-0 load with cancellation safety. Resets all pagination state. */
    async function loadLocationNews() {
      // BUG 5e FIX: do not fire a backend request when country is blank (location not yet
      // resolved). A blank country would reach ExternalNewsService with null country and
      // previously triggered a Philippines RSS fetch. Keep isNewsLoading=true and set
      // isLocationPending=true so the skeleton stays visible while GPS resolves.
      if (!locationRequest.country || !locationRequest.location) {
        setIsLocationPending(true); // show "Detecting your location..." skeleton
        setIsNewsLoading(true);     // keep skeleton visible (showInitialNewsLoading stays true)
        return; // wait for GPS / manual location selection — do not hit the backend
      }

      // Location resolved — clear the pending flag and proceed with the fetch.
      setIsLocationPending(false);
      setPage(0); // reset to first page on any location change

      const cacheKey = `newshub.articles.cache.${[
        locationRequest.location,
        locationRequest.country,
        locationRequest.area,
        0,
      ].join('|')}`;
      const cacheTtlMs = 300000;
      let cachedPayload = null;

      try {
        const raw = window.localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const isFresh = typeof parsed?.cachedAt === 'number' && (Date.now() - parsed.cachedAt) < cacheTtlMs;
          if (isFresh && Array.isArray(parsed?.items)) {
            cachedPayload = {
              items: parsed.items.slice(0, 8),
              hasMore: Boolean(parsed.hasMore),
              totalCount: Number.isFinite(parsed.totalCount) ? parsed.totalCount : 0,
            };
          }
        }
      } catch {
        cachedPayload = null;
      }

      if (cachedPayload) {
        setNewsArticles(cachedPayload.items);
        setHasMore(cachedPayload.hasMore);
        setTotalCount(cachedPayload.totalCount);
        setNewsError(cachedPayload.items.length === 0 ? 'No current-year news found for this location yet.' : '');
        setIsNewsLoading(false);
      } else {
        setNewsArticles([]);
        setHasMore(false);
        setTotalCount(0);
        setNewsError('');
        setIsNewsLoading(true);
      }
      try {
        const result = await fetchNewsByLocation({
          ...locationRequest,
          page: 0,
          size: 4,
          signal: abortController.signal,
        });
        if (!abortController.signal.aborted) {
          setNewsArticles(result.items);
          setHasMore(result.hasMore);
          setTotalCount(result.totalCount);
          setNewsError(result.items.length === 0 ? 'No current-year news found for this location yet.' : '');
          try {
            window.localStorage.setItem(
              cacheKey,
              JSON.stringify({
                cachedAt: Date.now(),
                items: result.items.slice(0, 8),
                hasMore: result.hasMore,
                totalCount: result.totalCount,
              })
            );
          } catch {
            // Ignore cache write failures (private mode, quota, etc.).
          }
        }
      } catch (error) {
        if (error?.name !== 'AbortError' && !abortController.signal.aborted && !cachedPayload) {
          setNewsArticles([]);
          setNewsError('Unable to fetch location-based news right now.');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsNewsLoading(false);
        }
      }
    }

    loadLocationNews();
    return () => abortController.abort();
  }, [locationRequest]);

  /**
   * Fetches the next page and APPENDS items to the existing list.
   * Uses isLoadingMore (not isNewsLoading) so the full skeleton is never shown.
   */
  const loadMore = async () => {
    if (!hasMore || isLoadingMore) return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      const result = await fetchNewsByLocation({
        ...locationRequest,
        page: nextPage,
        size: 4,
      });
      setNewsArticles((prev) => [...prev, ...result.items]); // APPEND — never replace
      setHasMore(result.hasMore);
      setTotalCount(result.totalCount);
      setPage(nextPage);
    } catch {
      // Silently swallow load-more errors; the existing articles remain visible.
    } finally {
      setIsLoadingMore(false);
    }
  };

  return {
    selectedLocation,
    locationLabel,
    isDetecting,
    locationError,
    newsArticles,
    isNewsLoading,
    newsError,
    setSelectedLocation,
    setUserLocationFromSearch,
    useCurrentUserLocation,
    userLocationDisplayLabel: userLocationDetails.label,
    isUsingCurrentLocation,
    // Exposed so consumers can build a locationContext for search filtering.
    area: userLocationDetails.area,
    country: userLocationDetails.country,
    // BUG 5e FIX: expose pending flag so Home.jsx / HomeNewsGrid can show the
    // "Detecting your location..." spinner while country is not yet resolved.
    isLocationPending,
    // Pagination
    hasMore,
    isLoadingMore,
    loadMore,
    totalCount,
  };
}
