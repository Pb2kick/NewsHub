/**
 * Returns a deterministic fallback location from coarse coordinates.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {{ area: string, country: string }}
 */
export function fallbackLocationFromCoordinates(latitude, longitude) {
  if (longitude < 121.0) {
    return { area: 'North Province', country: 'Philippines' };
  }

  if (latitude < 14.4) {
    return { area: 'Central Region', country: 'Philippines' };
  }

  return { area: 'Metro District', country: 'Philippines' };
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
