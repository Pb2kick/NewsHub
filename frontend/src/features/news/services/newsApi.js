const NEWS_API_BASE_URL = process.env.REACT_APP_NEWS_API_BASE_URL || 'http://localhost:8080';

/**
 * Upgrades common CDN image size parameters so the proxy fetches the
 * highest available resolution instead of the thumbnail the news API returns.
 *
 * Handles:
 *  - Generic: w=, width=, h=, height=  (bumped to 1200 / 900 when under threshold)
 *  - resize=WxH style (bumped to 1200x900 when under threshold)
 *  - q= quality param (bumped to 90 when low)
 *  - maxwidth= (bumped to 1200 when under threshold)
 *
 * @param {string} url - Raw image URL from the news API.
 * @returns {string} URL with upgraded size params, or the original if none matched.
 */
function upgradeImageResolution(url) {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    let changed = false;

    if (params.has('w')) {
      const current = parseInt(params.get('w'), 10);
      if (!isNaN(current) && current < 800) { params.set('w', '1200'); changed = true; }
    }
    if (params.has('width')) {
      const current = parseInt(params.get('width'), 10);
      if (!isNaN(current) && current < 800) { params.set('width', '1200'); changed = true; }
    }
    if (params.has('h')) {
      const current = parseInt(params.get('h'), 10);
      if (!isNaN(current) && current < 600) { params.set('h', '900'); changed = true; }
    }
    if (params.has('height')) {
      const current = parseInt(params.get('height'), 10);
      if (!isNaN(current) && current < 600) { params.set('height', '900'); changed = true; }
    }
    if (params.has('q')) {
      const current = parseInt(params.get('q'), 10);
      if (!isNaN(current) && current < 80) { params.set('q', '90'); changed = true; }
    }
    // resize=WxH pattern (used by AP, Getty mirrors, etc.)
    if (params.has('resize')) {
      const val = params.get('resize');
      if (/^\d+x\d+$/i.test(val)) {
        const [w, h] = val.split(/x/i).map(Number);
        if (w < 800 || h < 600) { params.set('resize', '1200x900'); changed = true; }
      }
    }
    if (params.has('maxwidth')) {
      const current = parseInt(params.get('maxwidth'), 10);
      if (!isNaN(current) && current < 800) { params.set('maxwidth', '1200'); changed = true; }
    }

    return changed ? parsed.toString() : url;
  } catch {
    return url;
  }
}

/**
 * Wraps an external image URL so the browser fetches it through the backend
 * proxy instead of making a direct request to the publisher domain.
 *
 * This sidesteps server-side hotlink protection: the browser only ever talks
 * to our own origin; the backend adds the matching Referer header that
 * satisfies the publisher's hotlink check.
 *
 * Before proxying the URL, size parameters are upgraded so we fetch the
 * highest-resolution version available — this fixes blurry thumbnails.
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
  const upgraded = upgradeImageResolution(trimmed);
  return `${NEWS_API_BASE_URL}/api/news/image-proxy?url=${encodeURIComponent(upgraded)}`;
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
 * Optionally scoped to a location context (location mode + area + country).
 *
 * @param {{ query?: string, location?: string, area?: string, country?: string, signal?: AbortSignal }} options
 * @returns {Promise<Array>}
 */
export async function searchNews({ query = '', location, area, country, signal } = {}) {
  const params = new URLSearchParams({ q: query });
  if (location) params.set('location', location);
  if (area) params.set('area', area);
  if (country) params.set('country', country);
  const response = await fetch(
    `${NEWS_API_BASE_URL}/api/news/search?${params.toString()}`,
    { signal }
  );
  if (!response.ok) return [];
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}
