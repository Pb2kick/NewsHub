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
 *
 * BUG 7 FIX: was 'Metro District' / 'Philippines' — hardcoded PH defaults caused every
 * new user without a stored location to seed the DB with Philippines-tagged articles.
 * Returning blank country/area is safe: the backend's searchNews() already returns
 * List.of() when both location and country are blank, and the loadLocationNews() guard
 * (Fix 5e) prevents the news fetch from firing until a real location is resolved.
 *
 * @returns {{ area: string, country: string, label: string, latitude: number | null, longitude: number | null }}
 */
function fallbackUserLocationDetails() {
  return {
    area: '',            // was 'Metro District' — blank signals unresolved, not Philippines
    country: '',         // was 'Philippines'    — blank prevents PH-scoped DB seeding
    label: APPROXIMATE_LOCAL_LABEL, // now 'Location not yet resolved' (BUG 7 FIX in locations.js)
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
