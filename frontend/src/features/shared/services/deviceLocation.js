/**
 * Detects the visitor's location from the browser (GPS) or their IP address.
 * Both lookups always settle: they resolve to a location or to null, never hang.
 */
import { reverseGeocode, toUserLocation } from './locationApi';

/**
 * Longest wait for the browser's location answer. The geolocation API's own
 * timeout only starts once permission is granted, so an unanswered permission
 * prompt would otherwise keep detection running forever.
 */
export const GPS_ANSWER_TIMEOUT_MS = 15000;

/**
 * IP location services, tried in order. ipapi.co often answers 429 (rate
 * limited), so a second service keeps IP detection working when it does.
 * Each entry maps that service's field names to one shape.
 */
const IP_LOCATION_SERVICES = [
  {
    url: 'https://ipapi.co/json/',
    read: (ip) => ({
      city: ip.city,
      region: ip.region,
      country: ip.country_name,
      countryCode: ip.country_code,
      latitude: ip.latitude,
      longitude: ip.longitude,
    }),
  },
  {
    url: 'https://get.geojs.io/v1/ip/geo.json',
    read: (ip) => ({
      city: ip.city,
      region: ip.region,
      country: ip.country,
      countryCode: ip.country_code,
      latitude: ip.latitude,
      longitude: ip.longitude,
    }),
  },
];

function toCoordinate(value) {
  const number = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(number) ? number : null;
}

/** Asks one IP service; null when it fails, is rate limited or returns no country. */
async function askIpService(service, signal) {
  try {
    const response = await fetch(service.url, { signal });
    if (!response.ok) return null;
    const fields = service.read(await response.json());
    if (!fields.country) return null;
    return {
      ...fields,
      latitude: toCoordinate(fields.latitude),
      longitude: toCoordinate(fields.longitude),
    };
  } catch {
    return null;
  }
}

/**
 * Looks up an approximate location from the visitor's IP address, then maps
 * its coordinates to the city level through the backend. IP databases often
 * name a neighbourhood or barangay ("Pawing") that has almost no news coverage;
 * the reverse lookup turns that into its municipality ("Palo, Leyte").
 *
 * @param {AbortSignal} [signal]
 * @returns {Promise<import('./locationApi').UserLocation | null>}
 */
export async function lookupIpLocation(signal) {
  let ip = null;
  for (const service of IP_LOCATION_SERVICES) {
    ip = await askIpService(service, signal);
    if (ip || signal?.aborted) break;
  }
  if (!ip) return null;

  const cityLevel = ip.latitude !== null && ip.longitude !== null
    ? await reverseGeocode({ latitude: ip.latitude, longitude: ip.longitude, signal })
    : null;
  if (cityLevel) return cityLevel;

  // Backend unreachable: fall back to the IP service's own names.
  const city = (ip.city || '').trim();
  const region = (ip.region || '').trim();
  return toUserLocation({
    area: city || region,
    region: city && region && region !== city ? region : null,
    country: String(ip.country).trim(),
    countryCode: ip.countryCode || null,
    latitude: ip.latitude,
    longitude: ip.longitude,
  });
}

/**
 * Reads browser GPS and reverse geocodes it. Resolves null on denial, on an
 * error, when the browser gives no answer within timeoutMs (including an
 * unanswered permission prompt), or when geocoding fails.
 *
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<import('./locationApi').UserLocation | null>}
 */
export function lookupGpsLocation({ timeoutMs = GPS_ANSWER_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    let settled = false;
    let timer = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    timer = setTimeout(() => finish(null), timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (settled) return; // answered after we gave up; IP detection already decided
        clearTimeout(timer);
        const { latitude, longitude } = position.coords;
        reverseGeocode({ latitude, longitude }).then(finish, () => finish(null));
      },
      () => finish(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  });
}
