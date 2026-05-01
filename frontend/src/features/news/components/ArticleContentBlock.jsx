import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { useArticleComments } from '../hooks/useArticleComments';

const MAX_COMMENT_LENGTH = 2000;

function formatRelativeTime(isoTimestamp) {
  if (!isoTimestamp) return '';
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return '';

  const diffSeconds = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSeconds < 45) return 'just now';
  if (diffSeconds < 90) return '1 minute ago';

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

/**
 * Renders article body text, source link, and comments.
 * @param {{ articleId: string | number, excerpt: string, paragraphs: string[], sourceUrl: string }} props
 * @returns {JSX.Element}
 */
export default function ArticleContentBlock({ articleId, excerpt, paragraphs, sourceUrl }) {
  const {
    comments,
    commentCount,
    isLoading,
    error,
    currentUser,
    submitComment,
    deleteComment,
  } = useArticleComments(articleId);
  const [draft, setDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remainingCharacters = Math.max(0, MAX_COMMENT_LENGTH - draft.length);
  const isPostDisabled = isLoading || isSubmitting || draft.trim().length === 0;

  const handleSubmit = async () => {
    if (isPostDisabled) return;
    setIsSubmitting(true);
    try {
      await submitComment(draft);
      setDraft('');
    } catch {
      // Errors are surfaced via the hook error state.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    try {
      await deleteComment(commentId);
    } catch {
      // Errors are surfaced via the hook error state.
    }
  };

  return (
    <>
      <div className="prose prose-lg prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-a:text-blue-600 prose-img:rounded-xl">
        <p className="lead text-xl text-slate-600 mb-6 font-medium">{excerpt}</p>
        {paragraphs.map((paragraph) => (
          <p key={paragraph} className="mb-6">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="border-t border-slate-200 mt-12 pt-8 space-y-4">
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
        >
          Read Original Source
          <ExternalLink className="w-4 h-4" />
        </a>

        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-slate-500" />
          Comments ({commentCount})
        </h3>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading comments...
          </div>
        )}

        {!isLoading && comments.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Be the first to comment.
          </div>
        )}

        {!isLoading && comments.length > 0 && (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {comment.display_name || 'NewsHub User'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatRelativeTime(comment.created_at)}
                    </p>
                  </div>
                  {comment.user_id === currentUser?.id && (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      className="text-slate-400 hover:text-rose-500 transition-colors"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{comment.content}</p>
              </div>
            ))}
          </div>
        )}

        {currentUser ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Share your thoughts</span>
              <span>
                {remainingCharacters} / {MAX_COMMENT_LENGTH}
              </span>
            </div>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={MAX_COMMENT_LENGTH}
              rows={4}
              placeholder="Write a comment..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPostDisabled}
                className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:hover:bg-blue-600"
              >
                {isSubmitting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-6 text-center">
            <p className="text-slate-600 mb-4">Join the conversation. Sign in to post comments.</p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign In
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
