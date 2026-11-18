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
import { reverseGeocode } from '../../shared/services/locationApi';
import { lookupGpsLocation, lookupIpLocation } from '../../shared/services/deviceLocation';

// Home shows the first article as the featured story above a two-column grid.
// Loading 5 first (1 featured + 4 cards) and then 4 per "See more" keeps every
// grid row full; with 4 per page the grid always had an odd count and one gap.
const FIRST_PAGE_SIZE = 5;
const MORE_PAGE_SIZE = 4;
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
export function useLocationNews({ loadNews = true, category = null } = {}) {
  // "Top Stories" (or nothing) means every category.
  const categoryFilter = category && category !== 'Top Stories' ? category : null;
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
      // Filtered in the database, so a tab shows a full page of its own stories
      // instead of filtering the few articles already loaded.
      category: categoryFilter,
    }),
    [selectedLocation, userLocationDetails, categoryFilter]
  );

  useEffect(() => {
    if (!loadNews) return undefined;
    const abortController = new AbortController();
    const feedKey = [
      locationRequest.location,
      locationRequest.country,
      locationRequest.area,
      locationRequest.region || '',
      locationRequest.category || '',
    ].join('|');
    feedKeyRef.current = feedKey;
    if (loadMoreAbortRef.current) loadMoreAbortRef.current.abort();

    async function loadFirstPage() {
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

      // v2: first pages now hold 5 articles; older cached entries held 4.
      const cacheKey = `newshub.articles.cache.v2.${feedKey}`;
      let cachedPayload = null;
      try {
        const parsed = JSON.parse(readStorage(cacheKey) || 'null');
        const isFresh = typeof parsed?.cachedAt === 'number' && Date.now() - parsed.cachedAt < FEED_CACHE_TTL_MS;
        if (isFresh && Array.isArray(parsed?.items)) {
          cachedPayload = {
            items: parsed.items.slice(0, FIRST_PAGE_SIZE),
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
          offset: 0,
          size: FIRST_PAGE_SIZE,
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

  /**
   * Fetches the next 4 articles after the ones on screen and appends them,
   * unless the location changed meanwhile.
   */
  const loadMore = async () => {
    if (!hasMore || isLoadingMore) return;
    const requestKey = feedKeyRef.current;
    const controller = new AbortController();
    loadMoreAbortRef.current = controller;
    setIsLoadingMore(true);
    try {
      const result = await fetchNewsByLocation({
        ...locationRequest,
        offset: newsArticles.length, // continue exactly after the last article shown
        size: MORE_PAGE_SIZE,
        signal: controller.signal,
      });
      if (controller.signal.aborted || feedKeyRef.current !== requestKey) return;
      setNewsArticles((prev) => {
        const seen = new Set(prev.map((item) => String(item.id)));
        return [...prev, ...result.items.filter((item) => !seen.has(String(item.id)))];
      });
      setHasMore(result.hasMore);
      setTotalCount(result.totalCount);
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
