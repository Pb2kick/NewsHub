import { useEffect, useMemo, useRef, useState } from 'react';
import { getSearchableElections } from '../../elections/services/electionsApi';
import { searchNews } from '../services/newsApi';
import { filterCandidates, filterElections } from '../../shared/utils/searchText';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

/**
 * Drives the global search dropdown.
 *
 * - Debounces the raw query by 300 ms before firing any work.
 * - Articles come from GET /api/news/search: ranked full-text search across all
 *   stored articles (word order does not matter, the last word may be partial),
 *   with the user's area and country ranked first. The dropdown never triggers
 *   a live fetch; the results page does.
 * - Elections and candidates are the real ones from Supabase (loaded once and
 *   cached), matched by every typed word.
 * - In-flight article requests are cancelled when the query changes.
 *
 * @param {string} query - Raw search string from the controlled input.
 * @param {{ area?: string, region?: string | null, country?: string, countryCode?: string | null } | undefined} locationContext
 *   Used only to rank results; search works before the location is known.
 * @returns {{ articleResults: Array, electionResults: Array, candidateResults: Array,
 *   isSearching: boolean, isSearchFailed: boolean, hasResults: boolean }}
 */
export function useGlobalSearch(query, locationContext) {
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [articleResults, setArticleResults] = useState([]);
  const [electionData, setElectionData] = useState({ elections: [], candidates: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFailed, setIsSearchFailed] = useState(false);
  const abortRef = useRef(null);
  const trimmedQuery = typeof query === 'string' ? query.trim() : '';
  // True during the debounce window, so the panel shows "Searching…" rather than
  // flashing "No results" before the request has even been sent.
  const isDebouncing = trimmedQuery.length >= MIN_QUERY_LENGTH && trimmedQuery !== debouncedQuery;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(trimmedQuery), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmedQuery]);

  // Real elections/candidates, fetched once when the user first searches.
  const hasQuery = debouncedQuery.length >= MIN_QUERY_LENGTH;
  useEffect(() => {
    if (!hasQuery) return undefined;
    let cancelled = false;
    getSearchableElections().then((data) => {
      if (!cancelled) setElectionData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [hasQuery]);

  const area = locationContext?.area;
  const region = locationContext?.region;
  const country = locationContext?.country;
  const countryCode = locationContext?.countryCode;

  useEffect(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    if (!hasQuery) {
      setArticleResults([]);
      setIsSearching(false);
      setIsSearchFailed(false);
      return undefined;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsSearching(true);
    setIsSearchFailed(false);

    searchNews({ query: debouncedQuery, area, region, country, countryCode, signal: controller.signal })
      .then((results) => {
        if (!controller.signal.aborted) setArticleResults(results);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError' && !controller.signal.aborted) {
          setArticleResults([]);
          setIsSearchFailed(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsSearching(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, hasQuery, area, region, country, countryCode]);

  const electionResults = useMemo(
    () => (hasQuery ? filterElections(electionData.elections, debouncedQuery) : []),
    [hasQuery, electionData, debouncedQuery]
  );
  const candidateResults = useMemo(
    () => (hasQuery ? filterCandidates(electionData.candidates, electionData.elections, debouncedQuery) : []),
    [hasQuery, electionData, debouncedQuery]
  );

  return {
    articleResults,
    electionResults,
    candidateResults,
    isSearching: isSearching || isDebouncing,
    isSearchFailed,
    hasResults: articleResults.length > 0 || electionResults.length > 0 || candidateResults.length > 0,
  };
}
