import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ArticleContentBlock from '../components/ArticleContentBlock';
import ArticleHeaderBlock from '../components/ArticleHeaderBlock';
import ArticleRelatedSection from '../components/ArticleRelatedSection';
import AuthenticatedPageShell from '../../shared/components/AuthenticatedPageShell';
import { useArticleDetails } from '../hooks/useArticleDetails';
import { NEWS_CATEGORY_TOP_STORIES } from '../../shared/constants/newsCategories';

/**
 * Renders the article detail page with full content and related stories.
 * @returns {JSX.Element}
 */
export default function Article() {
  const { id } = useParams();
  const routeContext = useLocation();
  const { isLoading, displayArticle, relatedArticles, articleParagraphs, originalSourceUrl } = useArticleDetails({
    id,
    routeArticle: routeContext.state?.article,
  });

  if (isLoading) {
    return (
      <AuthenticatedPageShell activeCategory={NEWS_CATEGORY_TOP_STORIES}>
        <div className="flex-1 grid place-items-center">
          <div className="text-slate-600 text-sm">Loading article...</div>
        </div>
      </AuthenticatedPageShell>
    );
  }

  if (!displayArticle) {
    return (
      <AuthenticatedPageShell activeCategory={NEWS_CATEGORY_TOP_STORIES}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          <Link to="/home" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors mb-6 text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to News
          </Link>
          <div className="max-w-4xl rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            No article is available for your current location yet. Please change location or try again shortly.
          </div>
        </div>
      </AuthenticatedPageShell>
    );
  }

  return (
    <AuthenticatedPageShell activeCategory={NEWS_CATEGORY_TOP_STORIES}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Link to="/home" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors mb-6 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" />
          Back to News
        </Link>

        <div className="max-w-4xl">
          <ArticleHeaderBlock article={displayArticle} />
          <ArticleContentBlock articleId={displayArticle.id} excerpt={displayArticle.excerpt} paragraphs={articleParagraphs} sourceUrl={originalSourceUrl} />
          <ArticleRelatedSection relatedArticles={relatedArticles} />
        </div>
      </div>
    </AuthenticatedPageShell>
  );
}
