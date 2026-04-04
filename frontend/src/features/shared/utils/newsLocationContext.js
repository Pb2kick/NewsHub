import {
  APPROXIMATE_LOCAL_LABEL,
  LOCATION_OPTIONS,
  LOCATION_STORAGE_KEY,
  USER_LOCATION_CURRENT,
  USER_LOCATION_STORAGE_KEY,
} from '../constants/locations';
import { toValidLocationMode } from './locationResolver';

/**
 * Returns default user location details when no manual payload exists.
 * @returns {{ area: string, country: string, label: string, latitude: number | null, longitude: number | null }}
 */
function fallbackUserLocationDetails() {
  return {
    area: 'Metro District',
    country: 'Philippines',
    label: APPROXIMATE_LOCAL_LABEL,
    latitude: null,
    longitude: null,
  };
}

/**
 * Parses a persisted manual location payload.
 * @returns {{ area: string, country: string, label: string, latitude: number | null, longitude: number | null } | null}
 */
function readManualLocationFromStorage() {
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
 * Resolves the current persisted news location context from local storage.
 * @returns {{
 *   request: { location: string, latitude: number | null, longitude: number | null, country: string, area: string },
 *   key: string
 * }}
 */
export function getPersistedNewsLocationContext() {
  const selectedLocation = toValidLocationMode(window.localStorage.getItem(LOCATION_STORAGE_KEY), LOCATION_OPTIONS);
  const details = readManualLocationFromStorage() || fallbackUserLocationDetails();

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
