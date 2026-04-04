const NEWS_API_BASE_URL = process.env.REACT_APP_NEWS_API_BASE_URL || 'http://localhost:8080';

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
