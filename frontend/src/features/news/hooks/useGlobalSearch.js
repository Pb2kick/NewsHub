import { useEffect, useMemo, useRef, useState } from 'react';
import { CANDIDATES, ELECTIONS } from '../../elections/data/mockData';
import { searchNews } from '../services/newsApi';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

/**
 * Drives the global search dropdown.
 *
 * - Debounces the raw query by 300 ms before firing any work.
 * - Articles are fetched from GET /api/news/search?q=… (backend JPQL LIKE query).
 * - Elections and candidates are filtered in-memory from mockData.js arrays.
 * - Every fetch is cancelled via AbortController when the query changes or the
 *   component unmounts, preventing stale-response races.
 *
 * @param {string} query - Raw search string from the controlled input.
 * @returns {{ articleResults: Array, electionResults: Array, candidateResults: Array, isSearching: boolean, hasResults: boolean }}
 */
export function useGlobalSearch(query) {
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [articleResults, setArticleResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const abortRef = useRef(null);

  // Debounce: update debouncedQuery 300 ms after the raw query stops changing.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(typeof query === 'string' ? query.trim() : '');
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch article results from backend whenever the debounced query changes.
  useEffect(() => {
    // Cancel any in-flight request from the previous query.
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (!debouncedQuery || debouncedQuery.length < MIN_QUERY_LENGTH) {
      setArticleResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsSearching(true);

    searchNews({ query: debouncedQuery, signal: controller.signal })
      .then((results) => {
        if (!controller.signal.aborted) {
          setArticleResults(results);
        }
      })
      .catch(() => {
        // Ignore abort errors; surface nothing for network failures.
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedQuery]);

  // Filter elections in-memory (case-insensitive match on title, region, status).
  const electionResults = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < MIN_QUERY_LENGTH) return [];
    const lower = debouncedQuery.toLowerCase();
    return ELECTIONS.filter(
      (e) =>
        e.title?.toLowerCase().includes(lower) ||
        e.region?.toLowerCase().includes(lower) ||
        e.status?.toLowerCase().includes(lower)
    );
  }, [debouncedQuery]);

  // Filter candidates in-memory (case-insensitive match on name, party, position).
  const candidateResults = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < MIN_QUERY_LENGTH) return [];
    const lower = debouncedQuery.toLowerCase();
    return CANDIDATES.filter(
      (c) =>
        c.name?.toLowerCase().includes(lower) ||
        c.party?.toLowerCase().includes(lower) ||
        c.position?.toLowerCase().includes(lower)
    );
  }, [debouncedQuery]);

  const hasResults =
    articleResults.length > 0 ||
    electionResults.length > 0 ||
    candidateResults.length > 0;

  return {
    articleResults,
    electionResults,
    candidateResults,
    isSearching,
    hasResults,
  };
}
