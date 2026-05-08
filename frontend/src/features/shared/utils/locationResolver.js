/**
 * Returns a neutral unresolved marker when coordinate-based country guessing is not feasible.
 *
 * BUG 6 FIX: The previous implementation used Philippines-specific coordinate thresholds
 * (lon < 121.0, lat < 14.4) that produce completely wrong results for any non-PH user.
 * A New Orleans user (lat≈29.95, lon≈-90.07) hit the lon < 121 branch and was tagged as
 * "North Province, Philippines" — contaminating every DB article they seeded.
 *
 * Coordinate-based country guessing is inherently unreliable for a global app. Return a
 * safe neutral marker instead; resolveLocationDetails() already uses Nominatim for real
 * GPS coordinates and only falls back here on network failure. "Unknown" signals to the
 * caller that the location is unresolved rather than silently assigning a wrong country.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {{ area: string, country: string }}
 */
export function fallbackLocationFromCoordinates(latitude, longitude) {
  // BUG 6 FIX: was three Philippines-specific branches that mis-tagged every non-PH user.
  // Return Unknown so callers surface a "location not resolved" state instead of wrong data.
  return { area: 'Unknown Area', country: 'Unknown' };
}

/**
 * Resolves a human-readable area label from coordinates via reverse geocoding.
 * @param {number} latitude
 * @param {number} longitude
 * @param {AbortSignal} signal
 * @returns {Promise<string>}
 */
export async function resolveLocationLabel(latitude, longitude, signal) {
  const fallback = fallbackLocationFromCoordinates(latitude, longitude);

  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(latitude),
      lon: String(longitude),
      zoom: '10',
      addressdetails: '1',
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return `${fallback.area}, ${fallback.country}`;
    }

    const payload = await response.json();
    const address = payload?.address || {};
    const area = address.city || address.town || address.state || address.region || fallback.area;
    const country = address.country || fallback.country;

    return `${area}, ${country}`;
  } catch {
    return `${fallback.area}, ${fallback.country}`;
  }
}

/**
 * Resolves structured location details from coordinates.
 * @param {number} latitude
 * @param {number} longitude
 * @param {AbortSignal} signal
 * @returns {Promise<{ area: string, country: string, label: string, latitude: number, longitude: number }>}
 */
export async function resolveLocationDetails(latitude, longitude, signal) {
  const fallback = fallbackLocationFromCoordinates(latitude, longitude);

  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(latitude),
      lon: String(longitude),
      zoom: '10',
      addressdetails: '1',
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return {
        area: fallback.area,
        country: fallback.country,
        label: `${fallback.area}, ${fallback.country}`,
        latitude,
        longitude,
      };
    }

    const payload = await response.json();
    const address = payload?.address || {};
    const area = address.city || address.town || address.state || address.region || fallback.area;
    const country = address.country || fallback.country;

    return {
      area,
      country,
      label: `${area}, ${country}`,
      latitude,
      longitude,
    };
  } catch {
    return {
      area: fallback.area,
      country: fallback.country,
      label: `${fallback.area}, ${fallback.country}`,
      latitude,
      longitude,
    };
  }
}

/**
 * Validates the selected location mode.
 * @param {string | null | undefined} value
 * @param {readonly string[]} options
 * @returns {string}
 */
export function toValidLocationMode(value, options) {
  return options.includes(value) ? value : 'Local';
}
