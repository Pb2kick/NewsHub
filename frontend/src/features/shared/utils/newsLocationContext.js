import {
  LAST_RESOLVED_LOCATION_STORAGE_KEY,
  LOCATION_OPTIONS,
  LOCATION_STORAGE_KEY,
  USER_LOCATION_CURRENT,
  USER_LOCATION_STORAGE_KEY,
} from '../constants/locations';
import { toValidLocationMode } from './locationResolver';
import { toUserLocation } from '../services/locationApi';

/**
 * Parses a stored location payload. Locations saved before Phase 2 have no
 * region/countryCode; callers re-normalize those once (see useLocationNews).
 * @param {string | null} raw
 * @returns {import('../services/locationApi').UserLocation | null}
 */
export function parseStoredLocation(raw) {
  if (!raw || raw === USER_LOCATION_CURRENT) {
    return null;
  }
  try {
    return toUserLocation(JSON.parse(raw));
  } catch {
    return null;
  }
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Resolves the user's news location context from local storage, for pages that
 * do not run location detection themselves (e.g. the article page).
 * Uses the manual location when one is set, otherwise the last detected one.
 * Country/area are blank when neither exists.
 *
 * @returns {{
 *   request: { location: string, latitude: number | null, longitude: number | null, country: string, area: string },
 *   key: string
 * }}
 */
export function getPersistedNewsLocationContext() {
  const selectedLocation = toValidLocationMode(readStorage(LOCATION_STORAGE_KEY), LOCATION_OPTIONS);
  const details = parseStoredLocation(readStorage(USER_LOCATION_STORAGE_KEY))
    || parseStoredLocation(readStorage(LAST_RESOLVED_LOCATION_STORAGE_KEY))
    || { area: '', region: null, country: '', countryCode: null, latitude: null, longitude: null };

  const request = {
    location: selectedLocation,
    latitude: selectedLocation === 'Local' ? details.latitude : null,
    longitude: selectedLocation === 'Local' ? details.longitude : null,
    country: details.country,
    countryCode: details.countryCode,
    area: details.area,
    region: details.region,
  };

  const key = [
    request.location,
    request.country,
    request.area,
    request.region || '',
    String(request.latitude ?? ''),
    String(request.longitude ?? ''),
  ].join('|');

  return { request, key };
}
