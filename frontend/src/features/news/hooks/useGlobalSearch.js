import { useEffect, useMemo, useRef, useState } from 'react';
import { CANDIDATES, ELECTIONS } from '../../elections/data/mockData';
import { searchNews } from '../services/newsApi';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

/**
 * Drives the global search dropdown.
 *
 * - Debounces the raw query by 300 ms before firing any work.
 * - Articles are fetched from GET /api/news/search?q=…&location=…&area=…&country=…
 *   so the backend scopes results to the user's current location.
 * - Elections and candidates are filtered in-memory from mockData.js arrays,
 *   scoped to the user's current area / location mode.
 * - Every fetch is cancelled via AbortController when the query changes or the
 *   component unmounts, preventing stale-response races.
 *
 * @param {string} query - Raw search string from the controlled input.
 * @param {{ selectedLocation: string, area: string, country: string } | undefined} locationContext
 *   Current location context from useLocationNews(). When undefined (not yet
 *   resolved), all results are shown unfiltered.
 * @returns {{ articleResults: Array, electionResults: Array, candidateResults: Array, isSearching: boolean, hasResults: boolean }}
 */
export function useGlobalSearch(query, locationContext) {
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

  // Fetch article results from backend whenever the debounced query or
  // location context changes. Location params are forwarded to the backend
  // so the JPQL query is already scoped to the correct region.
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

    searchNews({
      query: debouncedQuery,
      location: locationContext?.selectedLocation,
      area: locationContext?.area,
      country: locationContext?.country,
      signal: controller.signal,
    })
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
  }, [debouncedQuery, locationContext]);

  /**
   * Returns true when an election is relevant to the current location context.
   *
   * Rules:
   *  - If no locationContext yet → show everything (safe default).
   *  - selectedLocation === 'International' → hide all (elections are local/national).
   *  - selectedLocation === 'National' → show elections whose scope is 'National'
   *    OR whose region matches the user's country.
   *  - selectedLocation === 'Local' (default) → show only elections whose region
   *    case-insensitively matches the user's resolved area.
   */
  function isElectionInLocation(election) {
    if (!locationContext) return true;

    const { selectedLocation, area, country } = locationContext;
    const lowerRegion = (election.region || '').toLowerCase();
    const lowerScope = (election.scope || '').toLowerCase();

    if (selectedLocation === 'International') return false;

    if (selectedLocation === 'National') {
      return (
        lowerScope === 'national' ||
        lowerRegion === (country || '').toLowerCase()
      );
    }

    // Local — match region to area
    if (area) {
      return lowerRegion === area.toLowerCase();
    }

    return true;
  }

  /**
   * Returns true when a candidate is relevant to the current location context.
   * A candidate is considered local if their associated election is local.
   */
  function isCandidateInLocation(candidate) {
    if (!locationContext) return true;
    const election = ELECTIONS.find((e) => String(e.id) === String(candidate.electionId));
    if (!election) return false;
    return isElectionInLocation(election);
  }

  // Filter elections in-memory (case-insensitive match on title, region, status)
  // AND scoped to current location.
  const electionResults = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < MIN_QUERY_LENGTH) return [];
    const lower = debouncedQuery.toLowerCase();
    return ELECTIONS.filter(
      (e) =>
        isElectionInLocation(e) &&
        (
          e.title?.toLowerCase().includes(lower) ||
          e.region?.toLowerCase().includes(lower) ||
          e.status?.toLowerCase().includes(lower)
        )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, locationContext]);

  // Filter candidates in-memory (case-insensitive match on name, party, position)
  // AND scoped to current location via their parent election.
  const candidateResults = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < MIN_QUERY_LENGTH) return [];
    const lower = debouncedQuery.toLowerCase();
    return CANDIDATES.filter(
      (c) =>
        isCandidateInLocation(c) &&
        (
          c.name?.toLowerCase().includes(lower) ||
          c.party?.toLowerCase().includes(lower) ||
          c.position?.toLowerCase().includes(lower)
        )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, locationContext]);

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
