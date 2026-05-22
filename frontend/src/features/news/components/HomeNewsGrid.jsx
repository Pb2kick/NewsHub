import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { LOCATION_OPTIONS } from '../../shared/constants/locations';
import NewsImage from './NewsImage';

/**
 * Renders location picker, secondary article cards, and progressive See More controls.
 *
 * New props (alongside existing):
 *  - hasMore       {boolean} — whether further pages are available from the backend
 *  - isLoadingMore {boolean} — true while a loadMore() fetch is in flight
 *  - loadMore      {Function} — triggers the next page fetch (appends, never replaces)
 *
 * @param {object} props
 * @returns {JSX.Element}
 */
export default function HomeNewsGrid(props) {
  const {
    selectedLocation,
    setSelectedLocation,
    isDetecting,
    isNewsLoading,
    locationLabel,
    locationError,
    newsError,
    showInitialNewsLoading,
    otherArticles,
    hasImage,
    // BUG 5e FIX: true while GPS/country hasn't resolved — show detecting spinner
    isLocationPending = false,
    // Pagination props
    hasMore = false,
    isLoadingMore = false,
    loadMore,
  } = props;

  /** Skeleton card — identical class structure used for both initial load and See More. */
  function SkeletonCard({ id }) {
    return (
      <div key={id} className="h-56 sm:h-80 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden animate-pulse">
        <div className="h-24 sm:h-48 bg-slate-200 dark:bg-slate-600" />
        <div className="p-4 space-y-3">
          <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-1/2" />
          <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-4/5" />
          <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-3/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="lg:col-span-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span className="w-1.5 sm:w-2 h-6 sm:h-8 bg-blue-600 rounded-full block" />
          Latest News
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {/* BUG 5e FIX: show "Detecting your location" while country is blank */}
            {isLocationPending
              ? <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />Detecting your location&hellip;</span>
              : isDetecting ? 'Detecting location...'
              : isNewsLoading ? `Fetching ${selectedLocation} news...`
              : `Location: ${selectedLocation}`}
            {!isLocationPending && locationLabel && <span className="ml-2 text-slate-400">({locationLabel})</span>}
          </div>
          {locationError && !isDetecting && !isLocationPending && <span className="text-xs text-amber-600">{locationError}</span>}
          {newsError && !isNewsLoading && !isLocationPending && <span className="text-xs text-amber-600">{newsError}</span>}
          <select
            value={selectedLocation}
            onChange={(event) => setSelectedLocation(event.target.value)}
            className="px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            {LOCATION_OPTIONS.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Article grid — shows skeletons on initial load, detecting spinner, or articles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
        {/* BUG 5e FIX: show skeletons while GPS/country is resolving (isLocationPending) */}
        {(isLocationPending || showInitialNewsLoading) ? (
          Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={`loading-${index}`} id={`loading-${index}`} />
          ))
        ) : (
          <>
            {otherArticles.map((article) => (
              <Link
                key={article.id}
                to={`/news/${article.id}`}
                state={{ article }}
                className="group flex flex-row sm:flex-col h-auto sm:h-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="relative w-28 sm:w-full h-auto sm:h-48 overflow-hidden shrink-0">
                  {hasImage(article.image) ? (
                    <NewsImage
                      src={article.image}
                      alt={article.title}
                      className="w-full h-full min-h-[100px] object-cover transition-transform duration-500 group-hover:scale-110"
                      fallbackClassName="w-full h-full min-h-[100px] bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300"
                    />
                  ) : (
                    <div className="w-full h-full min-h-[100px] bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300" />
                  )}
                  <div className="absolute top-2 left-2 sm:top-4 sm:left-4">
                    <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-white/90 backdrop-blur-sm text-slate-900 text-[10px] sm:text-xs font-semibold rounded-md shadow-sm">
                      {article.category}
                    </span>
                  </div>
                </div>
                <div className="p-3 sm:p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-500 mb-1.5 sm:mb-3">
                    <span className="font-medium text-blue-600">{article.author}</span>
                    <span>•</span>
                    <span>{article.date}</span>
                  </div>
                  <h3 className="text-sm sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-1 sm:mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">{article.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm line-clamp-2 sm:line-clamp-3 mb-2 sm:mb-4 flex-1 hidden min-[360px]:block">{article.excerpt}</p>
                  <div className="flex items-center justify-between pt-2 sm:pt-4 border-t border-slate-100 dark:border-slate-700 mt-auto">
                    <span className="text-[10px] sm:text-xs text-slate-500 font-medium">{article.readTime}</span>
                    <span className="text-blue-600 text-xs sm:text-sm font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Read <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}

            {/* (b) Load-more skeleton cards appended inside the grid */}
            {isLoadingMore && (
              <>
                <SkeletonCard id="loading-more-0" />
                <SkeletonCard id="loading-more-1" />
              </>
            )}
          </>
        )}
      </div>

      {/* Controls below the grid — hidden during the initial full-skeleton load */}
      {!showInitialNewsLoading && (
        <>
          {/* (a) See More button — shown when more pages exist */}
          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                type="button"
                onClick={isLoadingMore ? undefined : loadMore}
                disabled={isLoadingMore}
                className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                See more articles
              </button>
            </div>
          )}

          {/* (c) End-of-feed indicator — shown only when all articles are loaded */}
          {!hasMore && otherArticles.length > 0 && (
            <div className="flex items-center gap-4 mt-8">
              <hr className="flex-1 border-slate-200 dark:border-slate-700" />
              <span className="text-xs text-slate-400 whitespace-nowrap">You're all caught up</span>
              <hr className="flex-1 border-slate-200 dark:border-slate-700" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
