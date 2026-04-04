/**
 * Resolves display area from a nominatim address payload.
 * @param {Record<string, string>} address
 * @param {string} displayName
 * @returns {string}
 */
function getAreaFromAddress(address, displayName) {
  const area =
    address.city ||
    address.town ||
    address.municipality ||
    address.state_district ||
    address.state ||
    address.region ||
    address.county ||
    address.village ||
    address.suburb ||
    address.hamlet;

  if (area && area.trim()) {
    return area.trim();
  }

  const displayFirstPart = String(displayName || '')
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.length > 0);

  return displayFirstPart || '';
}

/**
 * Maps raw Nominatim item to a clean suggestion object.
 * @param {Record<string, any>} item
 * @returns {{ area: string, country: string, label: string, latitude: number | null, longitude: number | null, score: number } | null}
 */
function mapSuggestion(item) {
  const address = item?.address || {};
  const country = String(address.country || '').trim();
  const area = getAreaFromAddress(address, item?.display_name);
  const latitude = Number(item?.lat);
  const longitude = Number(item?.lon);

  if (!country) {
    return null;
  }

  const cleanArea = area && area.toLowerCase() !== 'unknown area' ? area : country;
  const label = cleanArea === country ? country : `${cleanArea}, ${country}`;

  return {
    area: cleanArea,
    country,
    label,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    score: Number.isFinite(Number(item?.importance)) ? Number(item.importance) : 0,
  };
}

/**
 * Deduplicates suggestions by label while keeping highest-scored entry.
 * @param {Array<Record<string, any>>} payload
 * @returns {Array<{ area: string, country: string, label: string, latitude: number | null, longitude: number | null }>}
 */
export function buildUniqueLocationSuggestions(payload) {
  const rawMapped = Array.isArray(payload)
    ? payload
        .map((item) => mapSuggestion(item))
        .filter((item) => item !== null)
    : [];

  const byLabel = new Map();
  for (const suggestion of rawMapped) {
    const key = suggestion.label.trim().toLowerCase();
    const existing = byLabel.get(key);
    if (!existing || suggestion.score > existing.score) {
      byLabel.set(key, suggestion);
    }
  }

  return Array.from(byLabel.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ score, ...value }) => value);
}
