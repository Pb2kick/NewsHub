import { useEffect, useMemo, useState } from 'react';
import { fetchArticleById, fetchArticleContent, fetchNewsByLocation } from '../services/newsApi';
import { splitArticleIntoParagraphs } from '../../shared/utils/articleText';
import { getPersistedNewsLocationContext } from '../../shared/utils/newsLocationContext';

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

    /**
     * Loads related articles from the user's current feed. Runs in the
     * background so the article itself never waits on it.
     */
    async function loadRelated() {
      const { request } = getPersistedNewsLocationContext();
      if (!request.country || !request.area) {
        return;
      }
      try {
        const feed = await fetchNewsByLocation({ ...request, page: 0, size: 8, signal: abortController.signal });
        if (!abortController.signal.aborted) {
          setAllArticles(feed.items);
        }
      } catch {
        // Related articles are optional.
      }
    }

    /**
     * Shows the article passed through navigation state when there is one
     * (search results, feed cards); otherwise fetches it by id, which covers
     * page refreshes, shared links and notifications.
     */
    async function loadArticles() {
      setIsLoading(true);
      setAllArticles([]);
      setArticle(null);
      setResolvedContent('');
      loadRelated();

      if (routeArticle) {
        setArticle(routeArticle);
        setIsLoading(false);
        return;
      }

      try {
        const direct = id ? await fetchArticleById({ id, signal: abortController.signal }) : null;
        if (!abortController.signal.aborted) {
          setArticle(direct);
        }
      } catch {
        if (!abortController.signal.aborted) {
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
