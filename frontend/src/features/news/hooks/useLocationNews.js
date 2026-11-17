/**
 * useLocationNews.js
 *
 * Resolves the user's base location (manual pick, or browser GPS / IP lookup),
 * persists the selected scope (Local / National / International) and loads the
 * paginated news feed for it.
 *
 * Location priority: manual pick > GPS (reverse geocoded) > IP lookup.
 * The last successfully detected location is remembered so returning users see
 * their feed immediately while detection refreshes in the background.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchNewsByLocation } from '../services/newsApi';
import {
  APPROXIMATE_LOCAL_LABEL,
  LAST_RESOLVED_LOCATION_STORAGE_KEY,
  LOCATION_OPTIONS,
  LOCATION_STORAGE_KEY,
  USER_LOCATION_CURRENT,
  USER_LOCATION_STORAGE_KEY,
} from '../../shared/constants/locations';
import { toValidLocationMode } from '../../shared/utils/locationResolver';
import { parseStoredLocation } from '../../shared/utils/newsLocationContext';
import { reverseGeocode, toUserLocation } from '../../shared/services/locationApi';

const PAGE_SIZE = 4;
const FEED_CACHE_TTL_MS = 300000;

/** Blank details mean "not resolved yet"; the backend returns nothing for a blank country. */
function unresolvedLocation() {
  return {
    area: '', region: null, country: '', countryCode: null,
    label: APPROXIMATE_LOCAL_LABEL, latitude: null, longitude: null,
  };
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode / quota — location still works for this page view.
  }
}

/** Manually picked location, or null when the user chose "Use Current". */
function getStoredManualLocation() {
  const raw = readStorage(USER_LOCATION_STORAGE_KEY);
  if (!raw || raw === USER_LOCATION_CURRENT) {
    return null;
  }
  return parseStoredLocation(raw);
}

/** Last location that GPS or IP detection resolved successfully. */
function getLastResolvedLocation() {
  return parseStoredLocation(readStorage(LAST_RESOLVED_LOCATION_STORAGE_KEY));
}

/**
 * Looks up an approximate location from the visitor's IP address, then maps
 * its coordinates to the city level through the backend. IP databases often
 * name a neighbourhood or barangay ("Pawing") that has almost no news coverage;
 * the reverse lookup turns that into its municipality ("Palo, Leyte").
 */
async function lookupIpLocation(signal) {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal });
    if (!res.ok) return null;
    const ip = await res.json();
    const latitude = typeof ip.latitude === 'number' ? ip.latitude : null;
    const longitude = typeof ip.longitude === 'number' ? ip.longitude : null;

    const cityLevel = latitude !== null && longitude !== null
      ? await reverseGeocode({ latitude, longitude, signal })
      : null;
    if (cityLevel) return cityLevel;

    // Backend unreachable: fall back to the IP service's own names.
    return toUserLocation({
      area: (ip.city || ip.region || '').trim(),
      region: ip.city && ip.region && ip.region !== ip.city ? ip.region : null,
      country: (ip.country_name || '').trim(),
      countryCode: ip.country_code || null,
      latitude,
      longitude,
    });
  } catch {
    return null;
  }
}

/** Reads browser GPS and reverse geocodes it; resolves null on denial, timeout or geocode failure. */
function lookupGpsLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        resolve(await reverseGeocode({ latitude, longitude }));
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  });
}

function sameLocation(a, b) {
  return Boolean(a && b)
    && a.area.toLowerCase() === b.area.toLowerCase()
    && (a.region || '').toLowerCase() === (b.region || '').toLowerCase()
    && a.country.toLowerCase() === b.country.toLowerCase();
}

/** Locations saved before Phase 2 lack countryCode (and region); they get re-normalized once. */
function isLegacyLocation(details) {
  return Boolean(details?.area && details?.country && !details.countryCode);
}

/**
 * @param {{ loadNews?: boolean }} [options] Pass loadNews: false when only the
 *   location (for the header) is needed, e.g. on non-home pages.
 */
export function useLocationNews({ loadNews = true } = {}) {
  const [selectedLocation, setSelectedLocationState] = useState(() =>
    toValidLocationMode(readStorage(LOCATION_STORAGE_KEY), LOCATION_OPTIONS)
  );
  const [isUsingCurrentLocation, setIsUsingCurrentLocation] = useState(() => !getStoredManualLocation());
  const [userLocationDetails, setUserLocationDetails] = useState(
    () => getStoredManualLocation() || getLastResolvedLocation() || unresolvedLocation()
  );
  const [isDetecting, setIsDetecting] = useState(false);
  const [locationError, setLocationError] = useState('');
  // Bumped by "Use Current" so detection re-runs even when already in current mode.
  const [detectRequest, setDetectRequest] = useState(0);

  const [newsArticles, setNewsArticles] = useState([]);
  const [isNewsLoading, setIsNewsLoading] = useState(loadNews);
  const [newsError, setNewsError] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Identifies the feed currently on screen; a "See More" response for an older
  // location/scope is discarded instead of being appended to the new feed.
  const feedKeyRef = useRef('');
  const loadMoreAbortRef = useRef(null);

  const hasLocation = Boolean(userLocationDetails.country && userLocationDetails.area);
  const hasLocationRef = useRef(hasLocation);
  hasLocationRef.current = hasLocation;
  // Waiting on detection (no location yet and no failure reported).
  const isLocationPending = !hasLocation && !locationError;
  // Detection finished without a result: the user has to pick a location.
  const needsManualLocation = !hasLocation && Boolean(locationError) && !isDetecting;

  const setSelectedLocation = (nextLocation) => {
    const valid = toValidLocationMode(nextLocation, LOCATION_OPTIONS);
    writeStorage(LOCATION_STORAGE_KEY, valid);
    setSelectedLocationState(valid);
  };

  const setUserLocationFromSearch = (details) => {
    setIsUsingCurrentLocation(false);
    setIsDetecting(false);
    setLocationError('');
    setUserLocationDetails(details);
    writeStorage(USER_LOCATION_STORAGE_KEY, JSON.stringify(details));
  };

  const useCurrentUserLocation = useCallback(() => {
    writeStorage(USER_LOCATION_STORAGE_KEY, USER_LOCATION_CURRENT);
    setIsUsingCurrentLocation(true);
    setDetectRequest((count) => count + 1);
  }, []);

  useEffect(() => {
    if (!isUsingCurrentLocation) {
      setIsDetecting(false);
      return undefined;
    }

    const abortController = new AbortController();
    setIsDetecting(true);
    setLocationError('');

    let accepted = null;
    const accept = (result, { override }) => {
      if (!result || abortController.signal.aborted) return;
      if (accepted && (!override || sameLocation(accepted, result))) return;
      accepted = result;
      setUserLocationDetails(result);
      writeStorage(LAST_RESOLVED_LOCATION_STORAGE_KEY, JSON.stringify(result));
    };

    const ipPromise = lookupIpLocation(abortController.signal);
    const gpsPromise = lookupGpsLocation();

    // IP usually answers first; GPS is more precise, so a valid GPS result may
    // replace an IP result, but never the other way round.
    ipPromise.then((result) => accept(result, { override: false }));
    gpsPromise.then((result) => accept(result, { override: true }));

    Promise.allSettled([ipPromise, gpsPromise]).then(() => {
      if (abortController.signal.aborted) return;
      setIsDetecting(false);
      // A remembered location stays in use silently when re-detection fails.
      if (!accepted && !hasLocationRef.current) {
        setLocationError('We couldn’t detect your location. Search for your city in the location box.');
      }
    });

    return () => abortController.abort();
  }, [isUsingCurrentLocation, detectRequest]);

  // One-time upgrade of a manually picked location saved before regions and
  // country codes existed (detected locations are refreshed by detection anyway).
  useEffect(() => {
    if (isUsingCurrentLocation || !isLegacyLocation(userLocationDetails)) return undefined;
    const { latitude, longitude } = userLocationDetails;
    if (latitude === null || longitude === null) return undefined;

    const abortController = new AbortController();
    reverseGeocode({ latitude, longitude, signal: abortController.signal }).then((normalized) => {
      if (!normalized || abortController.signal.aborted) return;
      setUserLocationDetails(normalized);
      writeStorage(USER_LOCATION_STORAGE_KEY, JSON.stringify(normalized));
    });
    return () => abortController.abort();
  }, [isUsingCurrentLocation, userLocationDetails]);

  const locationRequest = useMemo(
    () => ({
      location: selectedLocation,
      latitude: selectedLocation === 'Local' ? userLocationDetails.latitude : null,
      longitude: selectedLocation === 'Local' ? userLocationDetails.longitude : null,
      country: userLocationDetails.country,
      countryCode: userLocationDetails.countryCode,
      area: userLocationDetails.area,
      region: userLocationDetails.region,
    }),
    [selectedLocation, userLocationDetails]
  );

  useEffect(() => {
    if (!loadNews) return undefined;
    const abortController = new AbortController();
    const feedKey = [
      locationRequest.location,
      locationRequest.country,
      locationRequest.area,
      locationRequest.region || '',
    ].join('|');
    feedKeyRef.current = feedKey;
    if (loadMoreAbortRef.current) loadMoreAbortRef.current.abort();

    async function loadFirstPage() {
      setPage(0);
      setIsLoadingMore(false);

      if (!locationRequest.country || !locationRequest.area || !locationRequest.location) {
        // Nothing to fetch until a location exists; pending/needsManualLocation drive the UI.
        setNewsArticles([]);
        setHasMore(false);
        setTotalCount(0);
        setNewsError('');
        setIsNewsLoading(false);
        return;
      }

      const cacheKey = `newshub.articles.cache.${feedKey}|0`;
      let cachedPayload = null;
      try {
        const parsed = JSON.parse(readStorage(cacheKey) || 'null');
        const isFresh = typeof parsed?.cachedAt === 'number' && Date.now() - parsed.cachedAt < FEED_CACHE_TTL_MS;
        if (isFresh && Array.isArray(parsed?.items)) {
          cachedPayload = {
            items: parsed.items.slice(0, PAGE_SIZE),
            hasMore: Boolean(parsed.hasMore),
            totalCount: Number.isFinite(parsed.totalCount) ? parsed.totalCount : 0,
          };
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
          size: PAGE_SIZE,
          signal: abortController.signal,
        });
        if (abortController.signal.aborted) return;
        setNewsArticles(result.items);
        setHasMore(result.hasMore);
        setTotalCount(result.totalCount);
        setNewsError(result.items.length === 0 ? 'No current-year news found for this location yet.' : '');
        writeStorage(
          cacheKey,
          JSON.stringify({ cachedAt: Date.now(), items: result.items, hasMore: result.hasMore, totalCount: result.totalCount })
        );
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

    loadFirstPage();
    return () => abortController.abort();
  }, [locationRequest, loadNews]);

  /** Fetches the next page and appends it, unless the location changed meanwhile. */
  const loadMore = async () => {
    if (!hasMore || isLoadingMore) return;
    const requestKey = feedKeyRef.current;
    const nextPage = page + 1;
    const controller = new AbortController();
    loadMoreAbortRef.current = controller;
    setIsLoadingMore(true);
    try {
      const result = await fetchNewsByLocation({
        ...locationRequest,
        page: nextPage,
        size: PAGE_SIZE,
        signal: controller.signal,
      });
      if (controller.signal.aborted || feedKeyRef.current !== requestKey) return;
      setNewsArticles((prev) => {
        const seen = new Set(prev.map((item) => String(item.id)));
        return [...prev, ...result.items.filter((item) => !seen.has(String(item.id)))];
      });
      setHasMore(result.hasMore);
      setTotalCount(result.totalCount);
      setPage(nextPage);
    } catch {
      // Keep the articles already on screen.
    } finally {
      if (feedKeyRef.current === requestKey) {
        setIsLoadingMore(false);
      }
    }
  };

  return {
    selectedLocation,
    locationLabel: userLocationDetails.label,
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
    area: userLocationDetails.area,
    region: userLocationDetails.region,
    country: userLocationDetails.country,
    countryCode: userLocationDetails.countryCode,
    isLocationPending,
    needsManualLocation,
    hasMore,
    isLoadingMore,
    loadMore,
    totalCount,
  };
}
