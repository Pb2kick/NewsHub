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
 * Persisted key for the last location GPS/IP detection resolved, so returning
 * users get their feed immediately and pages without the detector (article
 * page) still know the user's location.
 * @type {string}
 */
export const LAST_RESOLVED_LOCATION_STORAGE_KEY = 'newshub.lastResolvedLocation';

/**
 * Approximate label used when geolocation is unavailable.
 * BUG 7 FIX: was 'Metro District, Philippines (Approx.)' — hardcoded PH reference caused
 * every new user without a stored location to appear as a Philippines user.
 * @type {string}
 */
export const APPROXIMATE_LOCAL_LABEL = 'Location not yet resolved';
