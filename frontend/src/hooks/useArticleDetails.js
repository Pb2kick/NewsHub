import { useEffect, useMemo, useState } from 'react';
import { fetchArticleContent, fetchNewsByLocation } from '../api/newsApi';
import { splitArticleIntoParagraphs } from '../utils/articleText';
import { getPersistedNewsLocationContext } from '../utils/newsLocationContext';

/**
 * Manages article page data, fallbacks, and content extraction state.
 * @param {{ id: string | undefined, routeArticle: any }} params
 * @returns {{
 *   isLoading: boolean,
 *   displayArticle: any,
 *   relatedArticles: any[],
 *   articleParagraphs: string[],
 *   hasSourceUrl: boolean,
 *   originalSourceUrl: string
 * }}
 */
export function useArticleDetails({ id, routeArticle }) {
  const [article, setArticle] = useState(routeArticle || null);
  const [allArticles, setAllArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedContent, setResolvedContent] = useState('');

  const displayArticle = article;

  const relatedArticles = useMemo(() => {
    if (!displayArticle) {
      return [];
    }
    return allArticles.filter((item) => String(item.id) !== String(displayArticle.id)).slice(0, 3);
  }, [allArticles, displayArticle]);

  const articleParagraphs = useMemo(() => {
    const rawText = resolvedContent || displayArticle?.content || displayArticle?.excerpt || '';
    return splitArticleIntoParagraphs(rawText);
  }, [resolvedContent, displayArticle?.content, displayArticle?.excerpt]);

  useEffect(() => {
    const abortController = new AbortController();

    /** Loads location-scoped article feed and replaces stale article state. */
    async function loadArticles() {
      setIsLoading(true);
      setAllArticles([]);
      setArticle(null);
      setResolvedContent('');

      const locationContext = getPersistedNewsLocationContext();

      try {
        const rows = await fetchNewsByLocation({ ...locationContext.request, signal: abortController.signal });
        if (!abortController.signal.aborted) {
          setAllArticles(rows);
          const selected = rows.find((item) => String(item.id) === String(id));
          setArticle(selected || rows[0] || null);
        }
      } catch {
        if (!abortController.signal.aborted) {
          setAllArticles([]);
          setArticle(null);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadArticles();
    return () => abortController.abort();
  }, [id, routeArticle]);

  useEffect(() => {
    const abortController = new AbortController();

    /** Loads extracted article content for full context. */
    async function loadFullContent() {
      const sourceUrl = displayArticle?.sourceUrl;
      if (!sourceUrl) {
        setResolvedContent('');
        return;
      }

      try {
        const payload = await fetchArticleContent({ url: sourceUrl, signal: abortController.signal });
        if (!abortController.signal.aborted) {
          setResolvedContent(payload.extracted ? payload.content : '');
        }
      } catch {
        if (!abortController.signal.aborted) {
          setResolvedContent('');
        }
      }
    }

    loadFullContent();
    return () => abortController.abort();
  }, [displayArticle?.sourceUrl]);

  const hasSourceUrl = typeof displayArticle?.sourceUrl === 'string' && displayArticle.sourceUrl.trim().length > 0;
  const fallbackSourceUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(displayArticle?.title || '')}`;

  return {
    isLoading,
    displayArticle,
    relatedArticles,
    articleParagraphs,
    hasSourceUrl,
    originalSourceUrl: hasSourceUrl ? displayArticle.sourceUrl : fallbackSourceUrl,
  };
}
