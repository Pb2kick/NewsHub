/**
 * Base site origin for auth redirects (email confirmation, etc.).
 * REACT_APP_SITE_URL overrides; otherwise uses the current browser origin.
 */
export function getSiteOrigin() {
  try {
    const fromEnv = process.env.REACT_APP_SITE_URL;
    if (fromEnv && typeof fromEnv === 'string') {
      return fromEnv.replace(/\/$/, '');
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin.replace(/\/$/, '');
    }
  } catch {
    // fall through
  }
  return 'https://newshub-s1dh.onrender.com';
}

/**
 * Full URL for the post-confirmation landing route.
 */
export function getEmailConfirmedRedirectUrl() {
  return `${getSiteOrigin()}/email-confirmed`;
}
