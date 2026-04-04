/**
 * Supported location modes for news filtering.
 * @type {readonly string[]}
 */
export const LOCATION_OPTIONS = Object.freeze(['Local', 'National', 'International']);

/**
 * Persisted key for selected location mode.
 * @type {string}
 */
export const LOCATION_STORAGE_KEY = 'newshub.selectedLocation';

/**
 * Persisted key for the selected user-base location.
 * @type {string}
 */
export const USER_LOCATION_STORAGE_KEY = 'newshub.userLocation';

/**
 * Reserved option key to use browser geolocation.
 * @type {string}
 */
export const USER_LOCATION_CURRENT = 'CURRENT';

/**
 * Approximate label used when geolocation is unavailable.
 * @type {string}
 */
export const APPROXIMATE_LOCAL_LABEL = 'Metro District, Philippines (Approx.)';
