const NEWS_API_BASE_URL = process.env.REACT_APP_NEWS_API_BASE_URL || 'http://localhost:8080';

/**
 * Wraps an external image URL so the browser fetches it through the backend
 * proxy instead of making a direct request to the publisher domain.
 *
 * This sidesteps server-side hotlink protection: the browser only ever talks
 * to our own origin; the backend adds the matching Referer header that
 * satisfies the publisher's hotlink check.
 *
 * Returns an empty string for blank or non-HTTP inputs so that NewsImage
 * still renders its gradient fallback for articles without a valid image.
 *
 * @param {string} src - Raw image URL returned by the news API.
 * @returns {string} Proxy URL or empty string when src is invalid.
 */
export function getProxiedImageUrl(src) {
  if (typeof src !== 'string') return '';
  const trimmed = src.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return '';
  return `${NEWS_API_BASE_URL}/api/news/image-proxy?url=${encodeURIComponent(trimmed)}`;
}

/**
 * Fetches news items filtered by location and optional coordinates.
 * @param {{ location?: string, latitude?: number | null, longitude?: number | null, country?: string, area?: string, signal?: AbortSignal }} options
 * @returns {Promise<Array>}
 */
export async function fetchNewsByLocation({ location, latitude, longitude, country, area, signal } = {}) {
  const params = new URLSearchParams();

  if (location) {
    params.set('location', location);
  }

  if (typeof latitude === 'number') {
    params.set('lat', String(latitude));
  }

  if (typeof longitude === 'number') {
    params.set('lng', String(longitude));
  }

  if (country) {
    params.set('country', country);
  }

  if (area) {
    params.set('area', area);
  }

  const query = params.toString();
  const url = `${NEWS_API_BASE_URL}/api/news${query ? `?${query}` : ''}`;
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Failed to fetch news. Status: ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

/**
 * Fetches extracted article content from a source URL.
 * @param {{ url?: string, signal?: AbortSignal }} options
 * @returns {Promise<{ content: string, extracted: boolean }>}
 */
export async function fetchArticleContent({ url, signal } = {}) {
  if (!url) {
    return { content: '', extracted: false };
  }

  const params = new URLSearchParams({ url });
  const response = await fetch(`${NEWS_API_BASE_URL}/api/news/content?${params.toString()}`, { signal });

  if (!response.ok) {
    throw new Error(`Failed to fetch article content. Status: ${response.status}`);
  }

  const payload = await response.json();
  return {
    content: payload?.content || '',
    extracted: Boolean(payload?.extracted),
  };
}
/**
 * Searches persisted articles by keyword against the backend full-text index.
 * @param {{ query?: string, signal?: AbortSignal }} options
 * @returns {Promise<Array>}
 */
export async function searchNews({ query = '', signal } = {}) {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(
    `${NEWS_API_BASE_URL}/api/news/search?${params.toString()}`,
    { signal }
  );
  if (!response.ok) return [];
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}
