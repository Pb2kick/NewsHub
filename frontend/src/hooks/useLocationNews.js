import { useEffect, useMemo, useState } from 'react';
import { fetchNewsByLocation } from '../api/newsApi';
import {
  APPROXIMATE_LOCAL_LABEL,
  LOCATION_OPTIONS,
  LOCATION_STORAGE_KEY,
  USER_LOCATION_CURRENT,
  USER_LOCATION_STORAGE_KEY,
} from '../constants/locations';
import { resolveLocationDetails, toValidLocationMode } from '../utils/locationResolver';

/**
 * Returns default location details for unsupported geolocation scenarios.
 * @returns {{ area: string, country: string, label: string, latitude: number | null, longitude: number | null }}
 */
function fallbackUserLocation() {
  return {
    area: 'Metro District',
    country: 'Philippines',
    label: APPROXIMATE_LOCAL_LABEL,
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

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        resolveLocationDetails(latitude, longitude, abortController.signal).then((details) => {
          if (!abortController.signal.aborted) {
            setUserLocationDetails(details);
            setIsDetecting(false);
          }
        });
      },
      () => {
        setUserLocationDetails(fallbackUserLocation());
        setLocationError('Location access denied. Using approximate location.');
        setIsDetecting(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );

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

    /** Loads location-aware news with cancellation safety. */
    async function loadLocationNews() {
      setIsNewsLoading(true);
      setNewsArticles([]);
      setNewsError('');
      try {
        const fetchedNews = await fetchNewsByLocation({ ...locationRequest, signal: abortController.signal });
        if (!abortController.signal.aborted) {
          setNewsArticles(fetchedNews);
          setNewsError(fetchedNews.length === 0 ? 'No current-year news found for this location yet.' : '');
        }
      } catch (error) {
        if (error?.name !== 'AbortError' && !abortController.signal.aborted) {
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
  };
}
