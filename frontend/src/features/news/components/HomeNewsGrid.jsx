import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { LOCATION_OPTIONS } from '../../shared/constants/locations';
import NewsImage from './NewsImage';

/**
 * Renders location picker and secondary article cards.
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
  } = props;

  return (
    <div className="lg:col-span-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <span className="w-1.5 sm:w-2 h-6 sm:h-8 bg-blue-600 rounded-full block" />
          Latest News
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="text-xs sm:text-sm text-slate-500">
            {isDetecting ? 'Detecting location...' : isNewsLoading ? `Fetching ${selectedLocation} news...` : `Location: ${selectedLocation}`}
            {locationLabel && <span className="ml-2 text-slate-400">({locationLabel})</span>}
          </div>
          {locationError && !isDetecting && <span className="text-xs text-amber-600">{locationError}</span>}
          {newsError && !isNewsLoading && <span className="text-xs text-amber-600">{newsError}</span>}
          <select
            value={selectedLocation}
            onChange={(event) => setSelectedLocation(event.target.value)}
            className="px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            {LOCATION_OPTIONS.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
        {showInitialNewsLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={`loading-${index}`} className="h-56 sm:h-80 rounded-xl border border-slate-200 bg-white overflow-hidden animate-pulse">
              <div className="h-24 sm:h-48 bg-slate-200" />
              <div className="p-4 space-y-3">
                <div className="h-3 bg-slate-200 rounded w-1/2" />
                <div className="h-4 bg-slate-200 rounded w-4/5" />
                <div className="h-4 bg-slate-200 rounded w-3/5" />
              </div>
            </div>
          ))
        ) : (
          otherArticles.map((article) => (
            <Link key={article.id} to={`/news/${article.id}`} state={{ article }} className="group flex flex-row sm:flex-col h-auto sm:h-full bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
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
                <h3 className="text-sm sm:text-xl font-bold text-slate-900 mb-1 sm:mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">{article.title}</h3>
                <p className="text-slate-600 text-xs sm:text-sm line-clamp-2 sm:line-clamp-3 mb-2 sm:mb-4 flex-1 hidden min-[360px]:block">{article.excerpt}</p>
                <div className="flex items-center justify-between pt-2 sm:pt-4 border-t border-slate-100 mt-auto">
                  <span className="text-[10px] sm:text-xs text-slate-500 font-medium">{article.readTime}</span>
                  <span className="text-blue-600 text-xs sm:text-sm font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Read <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
