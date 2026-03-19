import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, Clock, ExternalLink, MessageSquare, Printer, Share2 } from 'lucide-react';
import { fetchArticleContent, fetchNewsByLocation } from '../api/newsApi';
import { NEWS_ARTICLES } from '../mockData';

export default function Article() {
  const { id } = useParams();
  const routeContext = useLocation();
  const [article, setArticle] = useState(routeContext.state?.article || null);
  const [allArticles, setAllArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedContent, setResolvedContent] = useState('');

  const fallbackArticle = useMemo(() => {
    return NEWS_ARTICLES.find((item) => String(item.id) === String(id)) || NEWS_ARTICLES[0];
  }, [id]);

  const displayArticle = article || fallbackArticle;

  const relatedArticles = useMemo(() => {
    const source = allArticles.length > 0 ? allArticles : NEWS_ARTICLES;
    return source
      .filter((item) => String(item.id) !== String(displayArticle.id))
      .slice(0, 3);
  }, [allArticles, displayArticle.id]);

  const articleParagraphs = useMemo(() => {
    const rawText = resolvedContent || displayArticle.content || displayArticle.excerpt || '';
    const normalized = rawText
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .trim();

    if (!normalized) {
      return ['Details for this article are still being synchronized. Please check back shortly for the full story body.'];
    }

    const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
    const chunks = [];

    for (let index = 0; index < sentences.length; index += 3) {
      chunks.push(sentences.slice(index, index + 3).join(' '));
    }

    return chunks.length > 0 ? chunks : [normalized];
  }, [resolvedContent, displayArticle.content, displayArticle.excerpt]);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadArticles() {
      setIsLoading(true);

      try {
        const rows = await fetchNewsByLocation({ location: 'All', signal: abortController.signal });

        if (!abortController.signal.aborted) {
          setAllArticles(rows);
          const selected = rows.find((item) => String(item.id) === String(id));
          setArticle(selected || routeContext.state?.article || null);
        }
      } catch {
        if (!abortController.signal.aborted) {
          setAllArticles(NEWS_ARTICLES);
          setArticle(routeContext.state?.article || null);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadArticles();

    return () => {
      abortController.abort();
    };
  }, [id, routeContext.state?.article]);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadFullContent() {
      const sourceUrl = displayArticle?.sourceUrl;
      if (!sourceUrl) {
        setResolvedContent('');
        return;
      }

      try {
        const payload = await fetchArticleContent({ url: sourceUrl, signal: abortController.signal });
        if (!abortController.signal.aborted) {
          setResolvedContent(payload.extracted ? payload.content : '');
        }
      } catch {
        if (!abortController.signal.aborted) {
          setResolvedContent('');
        }
      }
    }

    loadFullContent();

    return () => {
      abortController.abort();
    };
  }, [displayArticle?.sourceUrl]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 grid place-items-center">
        <div className="text-slate-600 text-sm">Loading article...</div>
      </div>
    );
  }

  const hasSourceUrl = typeof displayArticle.sourceUrl === 'string' && displayArticle.sourceUrl.trim().length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/home" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors mb-6 text-sm font-medium">
        <ArrowLeft className="w-4 h-4" />
        Back to News
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8">
          <header className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide">
                {displayArticle.category}
              </span>
              <span className="text-slate-400 text-sm">{displayArticle.readTime}</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              {displayArticle.title}
            </h1>

            <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-200 rounded-full overflow-hidden">
                  <img src="https://i.pravatar.cc/150?img=12" alt={displayArticle.author} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">{displayArticle.author}</p>
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Clock className="w-3 h-3" />
                    <span>{displayArticle.date}</span>
                    <span className="mx-1">•</span>
                    <span>{displayArticle.location}</span>
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
            <img src={displayArticle.image} alt={displayArticle.title} className="w-full h-[400px] object-cover" />
          </div>

          <div className="prose prose-lg prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-a:text-blue-600 prose-img:rounded-xl">
            <p className="lead text-xl text-slate-600 mb-6 font-medium">{displayArticle.excerpt}</p>
            {articleParagraphs.map((paragraph) => (
              <p key={paragraph} className="mb-6">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="border-t border-slate-200 mt-12 pt-8 space-y-4">
            {hasSourceUrl && (
              <a
                href={displayArticle.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
              >
                Read Original Source
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-slate-500" />
              Comments (24)
            </h3>
            <div className="bg-slate-50 rounded-xl p-6 text-center">
              <p className="text-slate-600 mb-4">Join the conversation. Sign in to post comments.</p>
              <button type="button" className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                Sign In
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="sticky top-24">
            <h3 className="text-lg font-bold text-slate-900 mb-6 border-l-4 border-blue-600 pl-3">
              Related Articles
            </h3>
            <div className="space-y-6">
              {relatedArticles.map((relatedArticle) => (
                <Link key={relatedArticle.id} to={`/news/${relatedArticle.id}`} state={{ article: relatedArticle }} className="group block">
                  <div className="flex gap-4 items-start">
                    <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden">
                      <img
                        src={relatedArticle.image}
                        alt={relatedArticle.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
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
          </div>
        </div>
      </div>
    </div>
  );
}
