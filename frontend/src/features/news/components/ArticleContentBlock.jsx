// frontend/src/features/news/components/ArticleContentBlock.jsx
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2, MessageSquare, Reply, Trash2 } from 'lucide-react';
import { useArticleComments } from '../hooks/useArticleComments';

const MAX_COMMENT_LENGTH = 2000;
const MAX_VISUAL_DEPTH = 4;

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

function buildTree(comments) {
  const nodesById = new Map();
  comments.forEach((comment) => {
    nodesById.set(comment.id, { ...comment, children: [] });
  });

  const roots = [];
  comments.forEach((comment) => {
    const node = nodesById.get(comment.id);
    const parentId = comment.parent_id;
    if (parentId && nodesById.has(parentId)) {
      nodesById.get(parentId).children.push(node);
    } else {
      // Orphan rows become roots so they are still visible.
      roots.push(node);
    }
  });

  const sortChildren = (node) => {
    node.children.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    node.children.forEach(sortChildren);
  };

  roots.forEach(sortChildren);
  return roots;
}

function CommentCard({
  node,
  depth,
  currentUser,
  replyingToId,
  replyDraft,
  isReplySubmitting,
  expandedIds,
  onToggleExpand,
  onOpenReply,
  onCancelReply,
  onReplyDraftChange,
  onReplySubmit,
  onDelete,
}) {
  const isExpanded = expandedIds.has(node.id);
  const isReplyOpen = replyingToId === node.id;
  const childCount = node.children.length;
  const displayName = node.display_name || 'NewsHub User';
  const displayContent = node.content && node.content.trim().length > 0
    ? node.content
    : 'Comment deleted';
  const isNested = depth > 0;

  const indentClass = depth === 0
    ? 'ml-0'
    : depth <= MAX_VISUAL_DEPTH
      ? 'ml-4'
      : 'ml-0';
  const threadClass = depth > 0 && depth <= MAX_VISUAL_DEPTH
    ? 'border-l-2 border-slate-100 dark:border-slate-700 pl-3'
    : '';
  const cardClass = isNested
    ? 'rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3'
    : 'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4';
  const gapClass = isNested ? 'gap-2.5' : 'gap-3';
  const nameClass = isNested ? 'text-xs' : 'text-sm';
  const bodyClass = isNested ? 'text-xs' : 'text-sm';
  const toggleOffsetClass = isNested ? 'ml-10' : 'ml-11';
  const replyBoxOffsetClass = isNested
    ? 'mt-1.5 border-l-2 border-blue-200 pl-3'
    : 'mt-1.5 ml-11 border-l-2 border-blue-200 pl-3';
  const contentSpacingClass = isNested ? 'mt-1' : 'mt-2';

  return (
    <div className={`${indentClass} ${threadClass}`}>
      <div className={cardClass}>
        <div className={`flex items-start ${gapClass}`}>
          <CommentAvatar
            photoUrl={node.profile_photo_url}
            displayName={displayName}
            size={isNested ? 'sm' : 'md'}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={`${nameClass} font-semibold text-slate-800 dark:text-slate-100`}>
                  {displayName}
                </p>
                <p className="text-xs text-slate-400">
                  {formatRelativeTime(node.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => onOpenReply(node.id)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    <Reply className="h-3 w-3" />
                    Reply
                  </button>
                )}
                {node.user_id === currentUser?.id && (
                  <button
                    type="button"
                    onClick={() => onDelete(node.id)}
                    className="text-slate-400 hover:text-rose-500 transition-colors"
                    aria-label="Delete comment"
                  >
                    <Trash2 className={isNested ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                  </button>
                )}
              </div>
            </div>

            <p className={`${contentSpacingClass} ${bodyClass} text-slate-700 dark:text-slate-300 whitespace-pre-wrap`}>
              {displayContent}
            </p>
          </div>
        </div>

        {childCount > 0 && (
          <button
            type="button"
            onClick={() => onToggleExpand(node.id)}
            className={`mt-3 ${toggleOffsetClass} text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors`}
          >
            {isExpanded
              ? 'Hide replies'
              : `${childCount} ${childCount === 1 ? 'reply' : 'replies'}`}
          </button>
        )}
      </div>

      {isReplyOpen && currentUser && (
        <div className={replyBoxOffsetClass}>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
            <textarea
              value={replyDraft}
              onChange={(e) => onReplyDraftChange(e.target.value)}
              maxLength={MAX_COMMENT_LENGTH}
              rows={2}
              placeholder={`Reply to ${displayName}…`}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancelReply}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onReplySubmit(node.id, displayName)}
                disabled={isReplySubmitting || replyDraft.trim().length === 0}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:hover:bg-blue-600"
              >
                {isReplySubmitting ? 'Posting…' : 'Reply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isExpanded && childCount > 0 && (
        <div className="mt-1.5 space-y-2">
          {node.children.map((child) => (
            <CommentCard
              key={child.id}
              node={child}
              depth={depth + 1}
              currentUser={currentUser}
              replyingToId={replyingToId}
              replyDraft={replyDraft}
              isReplySubmitting={isReplySubmitting}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onOpenReply={onOpenReply}
              onCancelReply={onCancelReply}
              onReplyDraftChange={onReplyDraftChange}
              onReplySubmit={onReplySubmit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
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
  const [replyingToId,      setReplyingToId]      = useState(null); // comment id
  const [replyDraft,        setReplyDraft]        = useState('');
  const [isReplySubmitting, setIsReplySubmitting] = useState(false);
  const [expandedIds,       setExpandedIds]       = useState(new Set());

  // ── Derive threaded structure ────────────────────────────────────────────
  const commentTree = useMemo(() => buildTree(comments), [comments]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const remainingChars = Math.max(0, MAX_COMMENT_LENGTH - draft.length);
  const isPostDisabled  = isLoading || isSubmitting || draft.trim().length === 0;

  const toggleExpanded = (commentId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const handleCancelReply = () => {
    setReplyingToId(null);
    setReplyDraft('');
  };

  const handleOpenReply = (commentId) => {
    if (replyingToId === commentId) {
      handleCancelReply();
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
      // Reply notifications already target the direct parent comment author (depth-agnostic).
      await submitComment(trimmed, parentId);
      setReplyDraft('');
      setReplyingToId(null);
      // Auto-expand the thread so the new reply is visible.
      setExpandedIds((prev) => new Set([...prev, parentId]));
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
      <div className="prose prose-lg prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-a:text-blue-600 prose-img:rounded-xl">
        <p className="lead text-xl text-slate-600 dark:text-slate-400 mb-6 font-medium">{excerpt}</p>
        {paragraphs.map((paragraph) => (
          <p key={paragraph} className="mb-6">
            {paragraph}
          </p>
        ))}
      </div>

      {/* ── Source + comments section ─────────────────────────────────────── */}
      <div className="border-t border-slate-200 dark:border-slate-700 mt-12 pt-8 space-y-4">
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
        >
          Read Original Source
          <ExternalLink className="w-4 h-4" />
        </a>

        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
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
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading comments...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && commentTree.length === 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
            Be the first to comment.
          </div>
        )}

        {/* ── Threaded comment list ─────────────────────────────────────── */}
        {!isLoading && commentTree.length > 0 && (
          <div className="space-y-3">
            {commentTree.map((comment) => (
              <CommentCard
                key={comment.id}
                node={comment}
                depth={0}
                currentUser={currentUser}
                replyingToId={replyingToId}
                replyDraft={replyDraft}
                isReplySubmitting={isReplySubmitting}
                expandedIds={expandedIds}
                onToggleExpand={toggleExpanded}
                onOpenReply={handleOpenReply}
                onCancelReply={handleCancelReply}
                onReplyDraftChange={setReplyDraft}
                onReplySubmit={handleReplySubmit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* ── Main compose box ──────────────────────────────────────────── */}
        {currentUser ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
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
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">Join the conversation. Sign in to post comments.</p>
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
