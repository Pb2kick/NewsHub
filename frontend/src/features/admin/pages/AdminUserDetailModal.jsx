import React, { useCallback, useEffect, useState } from 'react';
import { X, MessageSquare, Clock, ShieldCheck, ShieldX, ShieldOff } from 'lucide-react';
import AdminDataState from '../components/AdminDataState';
import AdminStatusBadge from '../components/AdminStatusBadge';
import { useAdminResource } from '../hooks/useAdminResource';
import { getUserById, getUserCommentHistory, getUserVerificationStatus } from '../services/adminApi';

/**
 * Slide-over modal displaying user profile details and comment history.
 * @param {{ user: any, onClose: () => void }} props
 * @returns {JSX.Element}
 */
export default function AdminUserDetailModal({ user, onClose }) {
  const [isScrollLocked, setIsScrollLocked] = useState(false);

  useEffect(() => {
    const current = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
    setIsScrollLocked(true);
    return () => {
      document.body.style.overflow = current || '';
      setIsScrollLocked(false);
    };
  }, []);

  const loadDetails = useCallback(async () => {
    const profile = await getUserById(user.id);
    const authUuid = profile?.auth_user_id || null;
    const [comments, verification] = await Promise.all([
      getUserCommentHistory(authUuid),
      getUserVerificationStatus(authUuid),
    ]);
    return { profile, comments, verification };
  }, [user.id]);

  const { data, loading, error } = useAdminResource(loadDetails, [user.id]);
  const profile = data?.profile || user;
  const comments = data?.comments || [];
  const verification = data?.verification || null;
  const authUuid = profile?.auth_user_id || null;
  const verificationStatus = verification?.status
    ? String(verification.status).toUpperCase()
    : null;

  const displayName = profile?.full_name || user?.full_name || 'User';
  const displayEmail = profile?.email || user?.email || '';
  const displayRole = profile?.role || user?.role || '';
  const profilePhotoUrl = profile?.profile_photo_url || '';

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'U';

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
  };

  const commentCountLabel = `${comments.length} comment${comments.length === 1 ? '' : 's'}`;

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div
        className="fixed right-0 top-0 h-full w-full max-w-lg bg-white z-50 shadow-xl overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        data-scroll-locked={isScrollLocked ? 'true' : 'false'}
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-start justify-between">
          <div>
            <p className="text-lg font-semibold text-slate-900">{displayName}</p>
            <p className="text-sm text-slate-500">{displayEmail}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <AdminDataState loading={loading} error={error} isEmpty={false} emptyText="" />
        </div>

        {!loading && !error ? (
          <>
            <section className="bg-slate-50 rounded-xl p-5 mx-6 mt-5">
              <div className="flex items-center gap-4 mb-4">
                {profilePhotoUrl ? (
                  <img
                    src={profilePhotoUrl}
                    alt={displayName}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-semibold">
                    {initials}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-900">Account Information</p>
                  <p className="text-xs text-slate-500">Details and role overview</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Display Name</p>
                  <p className="text-sm text-slate-900 font-medium">{displayName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Email</p>
                  <p className="text-sm text-slate-900 font-medium">{displayEmail || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Role</p>
                  <div className="mt-1">
                    <AdminStatusBadge value={displayRole} />
                  </div>
                </div>
                {authUuid ? (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Verification Status</p>
                    <div className="mt-1 flex items-center gap-2">
                      {verificationStatus === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 border border-green-200">
                          <ShieldCheck className="w-3 h-3" />
                          Verified
                        </span>
                      ) : verificationStatus === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium px-2 py-0.5 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          Pending Review
                        </span>
                      ) : verificationStatus === 'REJECTED' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 text-xs font-medium px-2 py-0.5 border border-red-200">
                          <ShieldX className="w-3 h-3" />
                          Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-500 text-xs font-medium px-2 py-0.5">
                          <ShieldOff className="w-3 h-3" />
                          Not Verified
                        </span>
                      )}
                      {verification?.submitted_at ? (
                        <span className="text-xs text-slate-400">
                          Submitted {formatDate(verification.submitted_at)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Member Since</p>
                  <p className="text-sm text-slate-900 font-medium">{formatDate(profile?.created_at)}</p>
                </div>
              </div>
            </section>

            <section className="mt-6">
              <div className="px-6 mb-3 flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">Comment History</h3>
                <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 text-xs px-2 py-0.5">
                  {commentCountLabel}
                </span>
              </div>

              {comments.length === 0 ? (
                <div className="mx-6 bg-slate-50 rounded-xl p-6 text-center text-sm text-slate-500">
                  <MessageSquare className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                  No comments yet.
                </div>
              ) : (
                <div>
                  {comments.map((comment) => {
                    const dateText = formatDate(comment.created_at);
                    const internalArticleUrl = comment.article_id
                      ? `/news/${comment.article_id}`
                      : null;
                    const title = comment.article_title || 'Article removed';
                    return (
                      <article key={comment.id} className="mx-6 mb-3 bg-white border border-slate-200 rounded-xl p-4">
                        <div className="text-sm font-medium text-blue-700">
                          {internalArticleUrl ? (
                            <a href={internalArticleUrl} target="_blank" rel="noreferrer" className="hover:underline">
                              {title}
                            </a>
                          ) : (
                            <span className="text-slate-400">{title}</span>
                          )}
                          {comment.article_source ? (
                            <span className="text-xs text-slate-400 ml-1">{comment.article_source}</span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span>{dateText}</span>
                          {comment.parent_id ? (
                            <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 text-blue-600 text-xs px-2 py-0.5">
                              Reply
                            </span>
                          ) : null}
                        </div>
                        <p
                          className="text-sm text-slate-700 mt-2"
                          style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
                        >
                          {comment.content}
                        </p>
                      </article>
                    );
                  })}
                  {comments.length === 50 ? (
                    <p className="text-xs text-slate-400 text-center pb-4">Showing latest 50 comments</p>
                  ) : null}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
