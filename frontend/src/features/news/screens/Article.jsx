/*
 * Changes:
 * - Added Report button in article header wrapper and ReportModal for news targets.
 */
import React, { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Flag } from 'lucide-react';
import ArticleContentBlock from '../components/ArticleContentBlock';
import ArticleHeaderBlock from '../components/ArticleHeaderBlock';
import ArticleRelatedSection from '../components/ArticleRelatedSection';
import AuthenticatedPageShell from '../../shared/components/AuthenticatedPageShell';
import ReportModal from '../../shared/components/ReportModal';
import { useArticleDetails } from '../hooks/useArticleDetails';
import { NEWS_CATEGORY_TOP_STORIES } from '../../shared/constants/newsCategories';

/**
 * Renders the article detail page with full content and related stories.
 * @returns {JSX.Element}
 */
export default function Article() {
  const { id } = useParams();
  const routeContext = useLocation();
  const [reportOpen, setReportOpen] = useState(false);
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="absolute top-0 right-0 z-10 flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500 transition-colors"
              title="Report this article"
            >
              <Flag className="w-3.5 h-3.5" />
              Report
            </button>
            <ArticleHeaderBlock article={displayArticle} />
          </div>
          <ArticleContentBlock articleId={displayArticle.id} articleTitle={displayArticle.title || ''} article={displayArticle} excerpt={displayArticle.excerpt} paragraphs={articleParagraphs} sourceUrl={originalSourceUrl} />

          <ArticleRelatedSection relatedArticles={relatedArticles} />
        </div>
      </div>

      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="news"
        targetId={String(displayArticle?.id ?? '')}
        targetLabel={displayArticle?.title ?? 'this article'}
      />
    </AuthenticatedPageShell>
  );
}
