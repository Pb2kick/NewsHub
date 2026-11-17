/**
 * Location lookups through the NewsHub backend, which normalizes every place
 * to the same shape: a city-level area, its province/state (region), the
 * English country name and the ISO country code.
 *
 * Geocoding used to run in the browser against Nominatim with different
 * field rules in each caller, so GPS, IP and manual picks could name the same
 * place differently and land in different feeds.
 */
const API_BASE_URL = process.env.REACT_APP_NEWS_API_BASE_URL || 'http://localhost:8080';

/**
 * @typedef {{
 *   area: string, region: string | null, country: string, countryCode: string | null,
 *   label: string, latitude: number | null, longitude: number | null
 * }} UserLocation
 */

/**
 * Reduces an API place (or a legacy stored object) to the persisted location shape.
 * @param {any} place
 * @returns {UserLocation | null}
 */
export function toUserLocation(place) {
  if (!place?.area || !place?.country) {
    return null;
  }
  const area = String(place.area);
  const country = String(place.country);
  const region = place.region ? String(place.region) : null;
  return {
    area,
    region,
    country,
    countryCode: place.countryCode ? String(place.countryCode).toUpperCase() : null,
    label: place.label ? String(place.label) : [area, region, country].filter(Boolean).join(', '),
    latitude: typeof place.latitude === 'number' ? place.latitude : null,
    longitude: typeof place.longitude === 'number' ? place.longitude : null,
  };
}

/**
 * Resolves coordinates (GPS or IP) to a city-level place.
 * @param {{ latitude: number, longitude: number, signal?: AbortSignal }} options
 * @returns {Promise<UserLocation | null>} null when nothing usable was found or the request failed
 */
export async function reverseGeocode({ latitude, longitude, signal }) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  try {
    const params = new URLSearchParams({ lat: String(latitude), lng: String(longitude) });
    const response = await fetch(`${API_BASE_URL}/api/location/reverse?${params.toString()}`, { signal });
    if (!response.ok) return null;
    return toUserLocation(await response.json());
  } catch {
    return null;
  }
}

/**
 * Place suggestions for the location box.
 * @param {{ query: string, signal?: AbortSignal }} options
 * @returns {Promise<Array<UserLocation & { matchedName: string | null, kind: string }>>}
 * @throws when the request fails, so the UI can tell "no matches" from "unavailable"
 */
export async function searchLocations({ query, signal }) {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`${API_BASE_URL}/api/location/search?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new Error(`Location search failed. Status: ${response.status}`);
  }
  const payload = await response.json();
  return (Array.isArray(payload) ? payload : [])
    .map((place) => {
      const location = toUserLocation(place);
      return location ? { ...location, matchedName: place.matchedName || null, kind: place.kind || 'city' } : null;
    })
    .filter(Boolean);
}
