import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, User } from 'lucide-react';
import NewsImage from './NewsImage';

/**
 * Renders featured news hero including loading and empty states.
 * @param {object} props
 * @returns {JSX.Element}
 */
export default function HomeHeroSection({ showInitialNewsLoading, featuredArticle, hasImage, needsManualLocation = false }) {
  if (needsManualLocation) {
    return (
      <section className="mb-6 sm:mb-12">
        <div className="rounded-xl sm:rounded-2xl border border-amber-200 bg-amber-50 dark:bg-slate-900 dark:border-amber-700 p-8 text-center text-slate-700 dark:text-slate-200">
          <p className="font-semibold">We couldn&rsquo;t detect your location.</p>
          <p className="mt-1 text-sm">Search for your city in the location box at the top of the page to see local news.</p>
        </div>
      </section>
    );
  }

  if (showInitialNewsLoading) {
    return (
      <section className="mb-6 sm:mb-12 animate-pulse">
        <div className="rounded-xl sm:rounded-2xl overflow-hidden shadow-lg bg-slate-200 h-[280px] sm:h-[400px] lg:h-[500px]" />
      </section>
    );
  }

  if (!featuredArticle) {
    return (
      <section className="mb-6 sm:mb-12">
        <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          No current-year headlines are available for this location yet.
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6 sm:mb-12">
      <div className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-lg group">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />
        {hasImage(featuredArticle.image) ? (
          <NewsImage
            src={featuredArticle.image}
            alt={featuredArticle.title}
            className="w-full h-[280px] sm:h-[400px] lg:h-[500px] object-cover transition-transform duration-700 group-hover:scale-105"
            fallbackClassName="w-full h-[280px] sm:h-[400px] lg:h-[500px] bg-gradient-to-br from-slate-700 via-slate-600 to-slate-800"
          />
        ) : (
          <div className="w-full h-[280px] sm:h-[400px] lg:h-[500px] bg-gradient-to-br from-slate-700 via-slate-600 to-slate-800" />
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-8 z-20">
          <span className="inline-block px-2.5 py-0.5 sm:px-3 sm:py-1 bg-blue-600 text-white text-[11px] sm:text-xs font-semibold rounded-full mb-2 sm:mb-4">
            {featuredArticle.category}
          </span>
          <h1 className="text-xl sm:text-3xl md:text-5xl font-bold text-white mb-2 sm:mb-4 leading-tight max-w-4xl">
            {featuredArticle.title}
          </h1>
          <p className="text-slate-200 text-sm sm:text-lg mb-3 sm:mb-6 max-w-2xl line-clamp-2 hidden min-[360px]:block">
            {featuredArticle.excerpt}
          </p>
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-slate-300 text-xs sm:text-sm font-medium">
            <span className="flex items-center gap-1.5 sm:gap-2">
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {featuredArticle.author}
            </span>
            <span className="flex items-center gap-1.5 sm:gap-2">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {featuredArticle.date}
            </span>
            <Link
              to={`/news/${featuredArticle.id}`}
              state={{ article: featuredArticle }}
              className="hidden sm:flex ml-auto items-center gap-2 text-white hover:text-blue-400 transition-colors group-hover:translate-x-1 duration-300"
            >
              Read Full Story <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
