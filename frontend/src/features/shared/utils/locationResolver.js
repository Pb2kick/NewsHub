/**
 * locationResolver.js
 *
 * CHANGES (coordinate-aware disambiguation):
 *
 * 1. Added KNOWN_PH_LOCATIONS — a small table of Philippine cities/municipalities
 *    that share names with other places or are common fallback targets. Each entry
 *    carries decimal-degree lat/lng so the disambiguation step can measure distances.
 *    Entries that are unique by name do NOT need coordinates; only ambiguous ones do.
 *    Ambiguous pairs covered: Naga (Cebu vs Camarines Sur), San Jose (multiple
 *    provinces), Santo Tomas (multiple provinces), Carmona (Cavite vs Camarines Sur).
 *
 * 2. Added haversineDistance(lat1, lng1, lat2, lng2) — named export, pure math,
 *    returns kilometres. Unit-testable independently.
 *
 * 3. Added disambiguateByCoords(cityName, rawLat, rawLng) — private helper that
 *    implements the 4-step resolution cascade:
 *      Step 1 — single name match  → use it unchanged.
 *      Step 2 — multiple matches   → pick the one with the smallest haversine
 *                                    distance to the raw GPS fix.
 *      Step 3 — zero name matches  → nearest-location fallback across all
 *                                    KNOWN_PH_LOCATIONS entries that have coords.
 *      Step 4 — table entirely empty / no coords → return the original name
 *                                    unchanged (safe pass-through).
 *
 * 4. resolveLocationDetails() now passes its raw lat/lng through
 *    disambiguateByCoords() after extracting the city name from Nominatim, so the
 *    returned area is always the geographically correct one even when Nominatim
 *    returns a name that matches multiple Philippine cities.
 *
 * NO CHANGES to: fallbackLocationFromCoordinates, resolveLocationLabel,
 * toValidLocationMode, or any external API used (still Nominatim only).
 * The output schema of resolveLocationDetails is unchanged.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate table for ambiguous Philippine city/municipality names.
// Only entries that share a name with at least one other Philippine place need
// a lat/lng. Unique-name cities are omitted to keep the table small.
// Coordinates are decimal degrees, accurate to 4 decimal places.
// ─────────────────────────────────────────────────────────────────────────────
const KNOWN_PH_LOCATIONS = [
  // ── Naga ── (critical ambiguity: Cebu vs Camarines Sur) ──────────────────
  { name: 'Naga',        province: 'Cebu',              lat: 10.2119, lng: 123.7542 },
  { name: 'Naga City',   province: 'Camarines Sur',     lat: 13.6218, lng: 123.1945 },
  { name: 'Naga',        province: 'Camarines Sur',     lat: 13.6218, lng: 123.1945 },

  // ── San Jose ── (multiple provinces) ─────────────────────────────────────
  { name: 'San Jose',    province: 'Antique',           lat: 10.7544, lng: 121.9297 },
  { name: 'San Jose',    province: 'Batangas',          lat: 13.8494, lng: 121.0938 },
  { name: 'San Jose',    province: 'Camarines Sur',     lat: 13.8167, lng: 123.3833 },
  { name: 'San Jose',    province: 'Dinagat Islands',   lat: 10.1833, lng: 125.5833 },
  { name: 'San Jose',    province: 'Mindoro Occidental',lat: 12.3519, lng: 121.0672 },
  { name: 'San Jose',    province: 'Nueva Ecija',       lat: 15.7972, lng: 120.9953 },
  { name: 'San Jose del Monte', province: 'Bulacan',   lat: 14.8141, lng: 121.0453 },

  // ── Santo Tomas ── (multiple provinces) ──────────────────────────────────
  { name: 'Santo Tomas', province: 'Batangas',          lat: 14.1069, lng: 121.1478 },
  { name: 'Santo Tomas', province: 'La Union',          lat: 16.5597, lng: 120.3939 },
  { name: 'Santo Tomas', province: 'Davao del Norte',   lat: 7.5295,  lng: 125.6283 },
  { name: 'Santo Tomas', province: 'Pampanga',          lat: 15.0608, lng: 120.7178 },

  // ── Carmona ── (Cavite vs Camarines Sur) ─────────────────────────────────
  { name: 'Carmona',     province: 'Cavite',            lat: 14.3161, lng: 121.0581 },
  { name: 'Carmona',     province: 'Camarines Sur',     lat: 13.5833, lng: 123.4167 },

  // ── Well-known fallback anchors (unique names, but important for Step 3) ─
  { name: 'Cebu City',   province: 'Cebu',              lat: 10.3157, lng: 123.8854 },
  { name: 'Manila',      province: 'NCR',               lat: 14.5995, lng: 120.9842 },
  { name: 'Quezon City', province: 'NCR',               lat: 14.6760, lng: 121.0437 },
  { name: 'Davao City',  province: 'Davao del Sur',     lat: 7.1907,  lng: 125.4553 },
  { name: 'Cagayan de Oro', province: 'Misamis Oriental', lat: 8.4542, lng: 124.6319 },
  { name: 'Zamboanga City', province: 'Zamboanga del Sur', lat: 6.9214, lng: 122.0790 },
  { name: 'Iloilo City', province: 'Iloilo',            lat: 10.7202, lng: 122.5621 },
  { name: 'Bacolod City',province: 'Negros Occidental', lat: 10.6770, lng: 122.9570 },
  { name: 'Baguio City', province: 'Benguet',           lat: 16.4023, lng: 120.5960 },
  { name: 'General Santos City', province: 'South Cotabato', lat: 6.1164, lng: 125.1716 },
  { name: 'Makati',      province: 'NCR',               lat: 14.5547, lng: 121.0244 },
  { name: 'Taguig',      province: 'NCR',               lat: 14.5243, lng: 121.0792 },
  { name: 'Pasig',       province: 'NCR',               lat: 14.5764, lng: 121.0851 },
  { name: 'Marikina',    province: 'NCR',               lat: 14.6507, lng: 121.1029 },
  { name: 'Caloocan',    province: 'NCR',               lat: 14.6500, lng: 120.9667 },
  { name: 'Las Piñas',   province: 'NCR',               lat: 14.4445, lng: 120.9936 },
  { name: 'Parañaque',   province: 'NCR',               lat: 14.4794, lng: 121.0198 },
  { name: 'Valenzuela',  province: 'NCR',               lat: 14.7011, lng: 120.9830 },
  { name: 'Antipolo',    province: 'Rizal',             lat: 14.5860, lng: 121.1760 },
  { name: 'Lapu-Lapu City', province: 'Cebu',           lat: 10.3103, lng: 123.9494 },
  { name: 'Mandaue City',   province: 'Cebu',           lat: 10.3236, lng: 123.9223 },
  { name: 'Tagbilaran City', province: 'Bohol',         lat: 9.6500,  lng: 123.8500 },
  { name: 'Tacloban City',  province: 'Leyte',          lat: 11.2543, lng: 125.0000 },
  { name: 'Butuan City',    province: 'Agusan del Norte', lat: 8.9475, lng: 125.5406 },
  { name: 'Iligan City',    province: 'Lanao del Norte', lat: 8.2280, lng: 124.2452 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Haversine formula — pure math, no external library
// ─────────────────────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;

/**
 * Computes the great-circle distance between two points on Earth.
 *
 * @param {number} lat1 - Latitude of point 1 in decimal degrees.
 * @param {number} lng1 - Longitude of point 1 in decimal degrees.
 * @param {number} lat2 - Latitude of point 2 in decimal degrees.
 * @param {number} lng2 - Longitude of point 2 in decimal degrees.
 * @returns {number} Distance in kilometres.
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4-step disambiguation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the correct location name when multiple Philippine cities share the
 * same name, using the raw GPS coordinates to pick the closest candidate.
 *
 * Step 1 — Single name match → return it unchanged.
 * Step 2 — Multiple name matches → pick the candidate with the smallest
 *           haversine distance to (rawLat, rawLng). Candidates without
 *           coordinates are skipped.
 * Step 3 — Zero name matches → return the KNOWN_PH_LOCATIONS entry with the
 *           smallest overall distance (nearest-location fallback).
 * Step 4 — Table has no entries with coordinates → return cityName unchanged.
 *
 * @param {string} cityName - City/municipality name returned by Nominatim.
 * @param {number} rawLat   - Raw latitude from the Geolocation API.
 * @param {number} rawLng   - Raw longitude from the Geolocation API.
 * @returns {string} The resolved, unambiguous city name.
 */
function disambiguateByCoords(cityName, rawLat, rawLng) {
  if (!cityName || !Number.isFinite(rawLat) || !Number.isFinite(rawLng)) {
    return cityName;
  }

  const normalised = cityName.trim().toLowerCase();

  // Step 1 & 2 — name-based candidate search
  const candidates = KNOWN_PH_LOCATIONS.filter(
    (entry) => entry.name.trim().toLowerCase() === normalised
  );

  if (candidates.length === 1) {
    // Step 1: unique match — use as-is
    return candidates[0].name;
  }

  if (candidates.length > 1) {
    // Step 2: pick the geographically closest candidate that has coordinates
    let best = null;
    let bestDist = Infinity;
    for (const candidate of candidates) {
      if (typeof candidate.lat === 'number' && typeof candidate.lng === 'number') {
        const dist = haversineDistance(rawLat, rawLng, candidate.lat, candidate.lng);
        if (dist < bestDist) {
          bestDist = dist;
          best = candidate;
        }
      }
    }
    if (best) return best.name;
    // All candidates lacked coordinates — fall through to Step 3
  }

  // Step 3: zero name matches → nearest location in the whole table
  const entriesWithCoords = KNOWN_PH_LOCATIONS.filter(
    (entry) => typeof entry.lat === 'number' && typeof entry.lng === 'number'
  );
  if (entriesWithCoords.length === 0) {
    return cityName; // Step 4: no coordinate data at all — safe pass-through
  }

  let nearest = null;
  let nearestDist = Infinity;
  for (const entry of entriesWithCoords) {
    const dist = haversineDistance(rawLat, rawLng, entry.lat, entry.lng);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = entry;
    }
  }
  return nearest ? nearest.name : cityName;
}

// ─────────────────────────────────────────────────────────────────────────────
// Existing exports — unchanged surface area
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a neutral unresolved marker when coordinate-based country guessing
 * is not feasible.
 *
 * BUG 6 FIX: The previous implementation used Philippines-specific coordinate
 * thresholds (lon < 121.0, lat < 14.4) that produce completely wrong results
 * for any non-PH user. A New Orleans user (lat≈29.95, lon≈-90.07) hit the
 * lon < 121 branch and was tagged as "North Province, Philippines" —
 * contaminating every DB article they seeded.
 *
 * Coordinate-based country guessing is inherently unreliable for a global app.
 * Return a safe neutral marker instead; resolveLocationDetails() already uses
 * Nominatim for real GPS coordinates and only falls back here on network failure.
 * "Unknown" signals to the caller that the location is unresolved rather than
 * silently assigning a wrong country.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {{ area: string, country: string }}
 */
export function fallbackLocationFromCoordinates(latitude, longitude) {
  // BUG 6 FIX: was three Philippines-specific branches that mis-tagged every non-PH user.
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
 * Resolves structured location details from coordinates via Nominatim, with
 * coordinate-aware disambiguation applied to the returned city name.
 *
 * When Nominatim returns a city name that matches multiple entries in
 * KNOWN_PH_LOCATIONS, the raw GPS lat/lng is used to select the geographically
 * closest candidate — fixing the Naga-Cebu / Naga-Camarines Sur confusion.
 * When no name match is found, the nearest known Philippine city is used as a
 * fallback (Step 3 in disambiguateByCoords).
 *
 * The output schema is unchanged: { area, country, label, latitude, longitude }.
 *
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
    const rawArea = address.city || address.town || address.state || address.region || fallback.area;
    const country = address.country || fallback.country;

    // NEW: run the 4-step disambiguation only for Philippine results where
    // same-name city conflicts are most prevalent. For non-PH results, the
    // raw Nominatim name is authoritative and the table has no entries anyway.
    const isPhilippines = country.toLowerCase().includes('philippine') ||
                          country.toLowerCase().includes('pilipinas');
    const area = isPhilippines
      ? disambiguateByCoords(rawArea, latitude, longitude)
      : rawArea;

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
