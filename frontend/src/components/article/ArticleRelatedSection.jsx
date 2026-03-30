import React from 'react';
import { Link } from 'react-router-dom';
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
 * Renders related articles list below the article body.
 * @param {{ relatedArticles: any[] }} props
 * @returns {JSX.Element}
 */
export default function ArticleRelatedSection({ relatedArticles }) {
  return (
    <section className="mt-12 border-t border-slate-200 pt-8">
      <h3 className="text-lg font-bold text-slate-900 mb-6 border-l-4 border-blue-600 pl-3">Related Articles</h3>
      <div className="space-y-6">
        {relatedArticles.map((relatedArticle) => (
          <Link key={relatedArticle.id} to={`/news/${relatedArticle.id}`} state={{ article: relatedArticle }} className="group block">
            <div className="flex gap-4 items-start">
              <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden">
                {hasImage(relatedArticle.image) ? (
                  <NewsImage
                    src={relatedArticle.image}
                    alt={relatedArticle.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    fallbackClassName="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300" />
                )}
              </div>
              <div>
                <span className="text-xs font-semibold text-blue-600 mb-1 block">{relatedArticle.category}</span>
                <h4 className="font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors line-clamp-3">
                  {relatedArticle.title}
                </h4>
                <span className="text-xs text-slate-400 mt-2 block">{relatedArticle.date}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
