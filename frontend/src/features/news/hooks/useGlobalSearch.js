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
 * - No network request is ever made while locationContext is unresolved (null /
 *   undefined) so the backend can never receive an unscoped query.
 *
 * @param {string} query - Raw search string from the controlled input.
 * @param {{ selectedLocation: string, area: string, country: string } | undefined} locationContext
 *   Current location context from useLocationNews(). When undefined or null
 *   (not yet resolved), all results are suppressed until context is available.
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

    // FIX C: locationContext is undefined/null during the initial render window
    // before useLocationNews() has resolved the user's location. Guard here so
    // we never fire an unscoped request to the backend. Clear any stale results
    // so a previous location's articles don't persist during the transition.
    if (!locationContext) {
      setArticleResults([]); // clear stale results from a previous location
      setIsSearching(false); // no request in flight
      return; // do not fetch until context is resolved
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsSearching(true);

    searchNews({
      query: debouncedQuery,
      location: locationContext.selectedLocation, // safe — locationContext is confirmed non-null above
      area: locationContext.area,
      country: locationContext.country,
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
   *  - If no locationContext yet → return false (safe default — show nothing
   *    until the user's location is resolved, preventing cross-locale leakage).
   *  - selectedLocation === 'International' → hide all (elections are local/national).
   *  - selectedLocation === 'National' → show elections whose scope is 'National'
   *    OR whose region matches the user's country.
   *  - selectedLocation === 'Local' with resolved area → match region to area.
   *  - selectedLocation === 'Local' with unresolved area → return false (safe
   *    default — do not show everything just because area isn't ready yet).
   */
  function isElectionInLocation(election) {
    // FIX C (frontend mirror): locationContext not yet resolved — suppress all results
    // so no elections from a foreign locale leak through during the initial render.
    if (!locationContext) return false; // safe default: show nothing until context arrives

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

    // Local — match region to area only when area is resolved.
    if (area) {
      return lowerRegion === area.toLowerCase(); // exact case-insensitive region match
    }

    // FIX D: area is falsy (not yet resolved) — return false instead of the
    // previous catch-all `return true` which leaked every election through.
    return false; // area unresolved: suppress rather than leak
  }

  /**
   * Returns true when a candidate is relevant to the current location context.
   * A candidate is in-location when their parent election passes isElectionInLocation.
   * Returns false when locationContext is unresolved, the parent election is not found,
   * or isElectionInLocation returns false — no catch-all leakage possible.
   */
  function isCandidateInLocation(candidate) {
    // FIX C+D (mirror): locationContext not resolved → suppress all candidates.
    if (!locationContext) return false; // safe default: matches the updated isElectionInLocation guard
    const election = ELECTIONS.find((e) => String(e.id) === String(candidate.electionId));
    if (!election) return false; // parent election not found — do not show candidate
    return isElectionInLocation(election); // delegates to fully-tightened location filter
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
