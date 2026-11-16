import {
  LAST_RESOLVED_LOCATION_STORAGE_KEY,
  LOCATION_OPTIONS,
  LOCATION_STORAGE_KEY,
  USER_LOCATION_CURRENT,
  USER_LOCATION_STORAGE_KEY,
} from '../constants/locations';
import { toValidLocationMode } from './locationResolver';

/**
 * Parses a stored location payload ({ area, country, label, latitude, longitude }).
 * @param {string | null} raw
 * @returns {{ area: string, country: string, label: string, latitude: number | null, longitude: number | null } | null}
 */
export function parseStoredLocation(raw) {
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
    || { area: '', country: '', latitude: null, longitude: null };

  const request = {
    location: selectedLocation,
    latitude: selectedLocation === 'Local' ? details.latitude : null,
    longitude: selectedLocation === 'Local' ? details.longitude : null,
    country: details.country,
    area: details.area,
  };

  const key = [
    request.location,
    request.country,
    request.area,
    String(request.latitude ?? ''),
    String(request.longitude ?? ''),
  ].join('|');

  return { request, key };
}
