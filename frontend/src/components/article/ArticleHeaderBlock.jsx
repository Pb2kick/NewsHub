import React from 'react';
import { Bookmark, Clock, Printer, Share2, User } from 'lucide-react';
import NewsImage from '../home/NewsImage';

/**
 * Checks whether an image URL can be rendered.
 * @param {string} imageUrl
 * @returns {boolean}
 */
function hasImage(imageUrl) {
  return typeof imageUrl === 'string' && imageUrl.trim().length > 0;
}

/**
 * Renders article title, metadata, actions, and hero image.
 * @param {{ article: any }} props
 * @returns {JSX.Element}
 */
export default function ArticleHeaderBlock({ article }) {
  const hasPublisherImage = typeof article.publisherImage === 'string' && article.publisherImage.trim().length > 0;

  return (
    <>
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide">
            {article.category}
          </span>
          <span className="text-slate-400 text-sm">{article.readTime}</span>
        </div>

        <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">{article.title}</h1>

        <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-200 rounded-full overflow-hidden">
              {hasPublisherImage ? (
                <img
                  src={article.publisherImage}
                  alt={article.author}
                  className="w-full h-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                    const fallbackIcon = event.currentTarget.parentElement?.querySelector('[data-publisher-fallback]');
                    if (fallbackIcon) {
                      fallbackIcon.classList.remove('hidden');
                    }
                  }}
                />
              ) : null}
              <div
                data-publisher-fallback
                className={`w-full h-full flex items-center justify-center text-slate-500 bg-slate-100 ${hasPublisherImage ? 'hidden' : ''}`}
              >
                <User className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="font-bold text-slate-900">{article.author}</p>
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Clock className="w-3 h-3" />
                <span>{article.date}</span>
                <span className="mx-1">&bull;</span>
                <span>{article.location}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Share">
              <Share2 className="w-5 h-5" />
            </button>
            <button type="button" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Bookmark">
              <Bookmark className="w-5 h-5" />
            </button>
            <button type="button" className="hidden sm:block p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Print">
              <Printer className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mb-10 rounded-2xl overflow-hidden shadow-sm">
        {hasImage(article.image) ? (
          <NewsImage src={article.image} alt={article.title} className="w-full h-[400px] object-cover" fallbackClassName="w-full h-[400px]" />
        ) : (
          <div className="w-full h-[400px] bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400" />
        )}
      </div>
    </>
  );
}
