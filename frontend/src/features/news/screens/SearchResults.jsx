import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, Newspaper, User, Vote } from 'lucide-react';
import AuthenticatedPageShell from '../../shared/components/AuthenticatedPageShell';
import NewsImage from '../components/NewsImage';
import { searchNews } from '../services/newsApi';
import { getSearchableElections } from '../../elections/services/electionsApi';
import { getPersistedNewsLocationContext } from '../../shared/utils/newsLocationContext';
import { filterCandidates, filterElections } from '../../shared/utils/searchText';
import { NEWS_CATEGORY_TOP_STORIES } from '../../shared/constants/newsCategories';

const PAGE_SIZE = 12;

/**
 * Full search results for /search?q=…
 *
 * The first page is requested with live=true: when few stored articles match,
 * the backend also searches the live news source and stores what it finds, so
 * this page can take a few seconds the first time a topic is searched.
 * Results from the user's area and country are ranked first.
 */
export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim();
  const [articles, setArticles] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [electionData, setElectionData] = useState({ elections: [], candidates: [] });

  // The user's location only ranks results; search works without it.
  const locationRequest = useMemo(() => getPersistedNewsLocationContext().request, []);
  const searchOptions = useMemo(() => ({
    query,
    area: locationRequest.area,
    region: locationRequest.region,
    country: locationRequest.country,
    countryCode: locationRequest.countryCode,
    size: PAGE_SIZE,
  }), [query, locationRequest]);

  useEffect(() => {
    setArticles([]);
    setPage(0);
    setHasMore(false);
    setIsFailed(false);
    if (query.length < 2) {
      setIsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setIsLoading(true);
    searchNews({ ...searchOptions, page: 0, live: true, signal: controller.signal })
      .then((results) => {
        if (controller.signal.aborted) return;
        setArticles(results);
        setHasMore(results.length === PAGE_SIZE);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError' && !controller.signal.aborted) setIsFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [query, searchOptions]);

  useEffect(() => {
    if (query.length < 2) return undefined;
    let cancelled = false;
    getSearchableElections().then((data) => {
      if (!cancelled) setElectionData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const loadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      const results = await searchNews({ ...searchOptions, page: nextPage });
      setArticles((previous) => {
        const seen = new Set(previous.map((item) => String(item.id)));
        return [...previous, ...results.filter((item) => !seen.has(String(item.id)))];
      });
      setHasMore(results.length === PAGE_SIZE);
      setPage(nextPage);
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const elections = useMemo(() => filterElections(electionData.elections, query, 10), [electionData, query]);
  const candidates = useMemo(
    () => filterCandidates(electionData.candidates, electionData.elections, query, 10),
    [electionData, query]
  );
  const nothingFound = !isLoading && !isFailed && articles.length === 0 && elections.length === 0 && candidates.length === 0;

  return (
    <AuthenticatedPageShell activeCategory={NEWS_CATEGORY_TOP_STORIES}>
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 w-full">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          {query.length >= 2 ? <>Results for &ldquo;{query}&rdquo;</> : 'Search'}
        </h1>
        {query.length < 2 && (
          <p className="mt-2 text-sm text-slate-500">Type at least 2 characters in the search box above.</p>
        )}

        {(elections.length > 0 || candidates.length > 0) && (
          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            {elections.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  <Vote className="w-3.5 h-3.5" /> Elections
                </h2>
                <ul className="mt-2 space-y-1">
                  {elections.map((election) => (
                    <li key={election.id}>
                      <Link to={`/elections/${election.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{election.title}</span>
                        <span className="ml-2 text-xs text-slate-500">{election.region} · {election.status}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {candidates.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  <User className="w-3.5 h-3.5" /> Candidates
                </h2>
                <ul className="mt-2 space-y-1">
                  {candidates.map((candidate) => (
                    <li key={candidate.id}>
                      <Link
                        to={`/elections/${candidate.electionId}/candidates/${candidate.id}`}
                        className="block rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{candidate.name}</span>
                        <span className="ml-2 text-xs text-slate-500">
                          {[candidate.party, candidate.position].filter(Boolean).join(' · ')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {query.length >= 2 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
              <Newspaper className="w-3.5 h-3.5" /> Articles
            </h2>

            {isLoading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-500" role="status">
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching NewsHub and news sources&hellip;
              </div>
            )}
            {isFailed && (
              <p className="mt-4 text-sm text-amber-700">Search is unavailable right now. Please try again in a moment.</p>
            )}
            {nothingFound && (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                No results for &ldquo;{query}&rdquo;. Try fewer or different words.
              </p>
            )}

            <ul className="mt-4 space-y-3">
              {articles.map((article) => (
                <li key={article.id}>
                  <Link
                    to={`/news/${article.id}`}
                    state={{ article }}
                    className="flex gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="w-24 h-20 sm:w-36 sm:h-24 shrink-0 overflow-hidden rounded-lg">
                      <NewsImage
                        src={article.image}
                        alt={article.title}
                        className="w-full h-full object-cover"
                        fallbackClassName="w-full h-full bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">
                        {[article.category, article.location, article.date].filter(Boolean).join(' · ')}
                      </p>
                      <h3 className="mt-0.5 text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                        {article.title}
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2">{article.excerpt}</p>
                      <p className="mt-1 text-xs text-slate-400">{article.author}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isLoadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                  More results
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </AuthenticatedPageShell>
  );
}
