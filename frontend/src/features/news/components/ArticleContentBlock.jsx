// frontend/src/features/news/components/ArticleContentBlock.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2, MessageSquare, Reply, Trash2 } from 'lucide-react';
import { useArticleComments } from '../hooks/useArticleComments';

const MAX_COMMENT_LENGTH = 2000;

function formatRelativeTime(isoTimestamp) {
  if (!isoTimestamp) return '';
  const now  = Date.now();
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

function getInitials(name) {
  if (!name) return 'NU';
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || 'NU'
  );
}

function CommentAvatar({ photoUrl, displayName, size = 'md' }) {
  const initials    = getInitials(displayName);
  const sizeClasses = size === 'sm'
    ? 'w-7 h-7 text-[10px]'
    : 'w-8 h-8 text-xs';

  return (
    <div
      className={`${sizeClasses} rounded-full bg-blue-100 text-blue-700 font-semibold grid place-items-center overflow-hidden shrink-0`}
    >
      {photoUrl
        ? <img src={photoUrl} alt={displayName || 'User'} className="w-full h-full object-cover" />
        : initials}
    </div>
  );
}

/**
 * Renders article body text, source link, and threaded comments.
 *
 * @param {{
 *   articleId:    string | number,
 *   articleTitle: string,
 *   article:      object | null,   Optional full article object — stored as a
 *                                  snapshot in reply notifications so recipients
 *                                  can navigate back without a location-scoped
 *                                  feed lookup. Safe to omit; defaults to null.
 *   excerpt:      string,
 *   paragraphs:   string[],
 *   sourceUrl:    string,
 * }} props
 */
export default function ArticleContentBlock({
  articleId,
  articleTitle = '',
  article      = null,
  excerpt,
  paragraphs,
  sourceUrl,
}) {
  const {
    comments,
    commentCount,
    isLoading,
    error,
    currentUser,
    submitComment,
    deleteComment,
  } = useArticleComments(articleId, articleTitle, article);


  // ── Main compose state ───────────────────────────────────────────────────
  const [draft,        setDraft]        = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Reply thread state ───────────────────────────────────────────────────
  const [replyingToId,     setReplyingToId]     = useState(null); // comment id
  const [replyDraft,       setReplyDraft]       = useState('');
  const [isReplySubmitting, setIsReplySubmitting] = useState(false);
  const [expandedReplies,  setExpandedReplies]  = useState(new Set());

  // ── Derive threaded structure ────────────────────────────────────────────
  const topLevelComments = comments.filter((c) => !c.parent_id);
  const repliesMap       = {};
  comments.forEach((c) => {
    if (c.parent_id) {
      if (!repliesMap[c.parent_id]) repliesMap[c.parent_id] = [];
      repliesMap[c.parent_id].push(c);
    }
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
  const remainingChars = Math.max(0, MAX_COMMENT_LENGTH - draft.length);
  const isPostDisabled  = isLoading || isSubmitting || draft.trim().length === 0;

  const toggleExpanded = (commentId) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const openReply = (commentId) => {
    if (replyingToId === commentId) {
      setReplyingToId(null);
      setReplyDraft('');
    } else {
      setReplyingToId(commentId);
      setReplyDraft('');
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isPostDisabled) return;
    setIsSubmitting(true);
    try {
      await submitComment(draft, null);
      setDraft('');
    } catch {
      // error surfaced via hook state
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplySubmit = async (parentId, parentDisplayName) => {
    const trimmed = replyDraft.trim();
    if (!trimmed || isReplySubmitting) return;
    setIsReplySubmitting(true);
    try {
      await submitComment(trimmed, parentId);
      setReplyDraft('');
      setReplyingToId(null);
      // Auto-expand the thread so the new reply is visible.
      setExpandedReplies((prev) => new Set([...prev, parentId]));
    } catch {
      // error surfaced via hook state
    } finally {
      setIsReplySubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    try {
      await deleteComment(commentId);
    } catch {
      // error surfaced via hook state
    }
  };

  return (
    <>
      {/* ── Article body ──────────────────────────────────────────────────── */}
      <div className="prose prose-lg prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-a:text-blue-600 prose-img:rounded-xl">
        <p className="lead text-xl text-slate-600 mb-6 font-medium">{excerpt}</p>
        {paragraphs.map((paragraph) => (
          <p key={paragraph} className="mb-6">
            {paragraph}
          </p>
        ))}
      </div>

      {/* ── Source + comments section ─────────────────────────────────────── */}
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

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading comments...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && topLevelComments.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Be the first to comment.
          </div>
        )}

        {/* ── Threaded comment list ─────────────────────────────────────── */}
        {!isLoading && topLevelComments.length > 0 && (
          <div className="space-y-3">
            {topLevelComments.map((comment) => {
              const replies    = repliesMap[comment.id] || [];
              const isExpanded = expandedReplies.has(comment.id);
              const isReplyOpen = replyingToId === comment.id;

              return (
                <div key={comment.id}>
                  {/* Top-level comment card */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <CommentAvatar
                        photoUrl={comment.profile_photo_url}
                        displayName={comment.display_name}
                      />
                      <div className="flex-1 min-w-0">
                        {/* Meta row */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {comment.display_name || 'NewsHub User'}
                            </p>
                            <p className="text-xs text-slate-400">
                              {formatRelativeTime(comment.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {currentUser && (
                              <button
                                type="button"
                                onClick={() => openReply(comment.id)}
                                className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
                              >
                                <Reply className="h-3 w-3" />
                                Reply
                              </button>
                            )}
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
                        </div>

                        {/* Content */}
                        <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      </div>
                    </div>

                    {/* Reply count toggle */}
                    {replies.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(comment.id)}
                        className="mt-3 ml-11 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        {isExpanded
                          ? 'Hide replies'
                          : `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                      </button>
                    )}
                  </div>

                  {/* ── Expanded reply thread ─────────────────────────── */}
                  {isExpanded && replies.length > 0 && (
                    <div className="ml-10 mt-1.5 border-l-2 border-slate-100 pl-3 space-y-2">
                      {replies.map((reply) => (
                        <div key={reply.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <div className="flex items-start gap-2.5">
                            <CommentAvatar
                              photoUrl={reply.profile_photo_url}
                              displayName={reply.display_name}
                              size="sm"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs font-semibold text-slate-800">
                                    {reply.display_name || 'NewsHub User'}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {formatRelativeTime(reply.created_at)}
                                  </p>
                                </div>
                                {reply.user_id === currentUser?.id && (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(reply.id)}
                                    className="text-slate-400 hover:text-rose-500 transition-colors"
                                    aria-label="Delete reply"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                              <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                                {reply.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Inline reply compose ──────────────────────────── */}
                  {isReplyOpen && currentUser && (
                    <div className="ml-10 mt-1.5 pl-3 border-l-2 border-blue-200">
                      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                        <textarea
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          maxLength={MAX_COMMENT_LENGTH}
                          rows={2}
                          placeholder={`Reply to ${comment.display_name || 'this comment'}…`}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => { setReplyingToId(null); setReplyDraft(''); }}
                            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReplySubmit(comment.id, comment.display_name)}
                            disabled={isReplySubmitting || replyDraft.trim().length === 0}
                            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:hover:bg-blue-600"
                          >
                            {isReplySubmitting ? 'Posting…' : 'Reply'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Main compose box ──────────────────────────────────────────── */}
        {currentUser ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Share your thoughts</span>
              <span>{remainingChars} / {MAX_COMMENT_LENGTH}</span>
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
