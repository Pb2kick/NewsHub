/**
 * locationResolver.js
 *
 * Geocoding now happens on the backend (see shared/services/locationApi.js),
 * which normalizes GPS, IP and searched places to one city-level shape. The
 * browser-side Nominatim calls and the Philippine same-name city table that
 * used to live here were removed: reverse geocoding from coordinates is
 * unambiguous, and searched places now carry their province, which is what
 * tells same-name cities apart (Naga, Cebu vs. Naga, Bicol Region).
 */

/**
 * Validates the selected location mode.
 * @param {string | null | undefined} value
 * @param {readonly string[]} options
 * @returns {string}
 */
export function toValidLocationMode(value, options) {
  return options.includes(value) ? value : 'Local';
}
