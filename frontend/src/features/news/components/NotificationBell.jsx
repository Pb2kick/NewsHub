// frontend/src/features/news/components/NotificationBell.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';

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

function formatRelativeTime(isoTimestamp) {
  if (!isoTimestamp) return '';
  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000)
  );
  if (diffSeconds < 45) return 'just now';
  if (diffSeconds < 90) return '1 minute ago';
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function NotifAvatar({ photoUrl, displayName }) {
  const initials = getInitials(displayName);
  return (
    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs grid place-items-center overflow-hidden shrink-0">
      {photoUrl
        ? <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
        : initials}
    </div>
  );
}

/**
 * Live notification bell with Unread / All tabbed dropdown inbox.
 *
 * REDIRECT BUG FIX: row clicks pass notif.article_snapshot as route state so
 * useArticleDetails uses the fast path (routeArticle) and never falls back to
 * the location-scoped feed that may not contain the article.
 *
 * @param {{
 *   notifications: Array,
 *   unreadCount: number,
 *   markOneRead: (id: number) => Promise<void>,
 *   markAllRead: () => Promise<void>,
 * }} props
 */
export default function NotificationBell({
  notifications = [],
  unreadCount   = 0,
  markOneRead,
  markAllRead,
}) {
  const navigate = useNavigate();

  const [isOpen,    setIsOpen]    = useState(false);
  const [activeTab, setActiveTab] = useState('unread'); // 'unread' | 'all'

  const containerRef      = useRef(null);
  const prevUnreadRef     = useRef(unreadCount);

  // ── Auto-switch to Unread tab when a new notification arrives ────────────
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setActiveTab('unread');
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // ── Close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    const onMouseDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // ── Row click: mark read + navigate with article snapshot ────────────────
  // Passing article_snapshot as route state means useArticleDetails uses the
  // routeArticle fast path and never calls the location-scoped feed API,
  // which would return "no article for your location" for cross-region articles.
  const handleRowClick = useCallback(
    async (notif) => {
      await markOneRead(notif.id);
      // Do NOT close the dropdown here — it closes naturally via outside-click
      // once the user has navigated away, per the design spec.
      navigate(`/news/${notif.article_id}`, {
        state: { article: notif.article_snapshot ?? null },
      });
    },
    [markOneRead, navigate]
  );

  const handleMarkAll = useCallback(async () => {
    await markAllRead();
  }, [markAllRead]);

  // ── Filtered list for the active tab ─────────────────────────────────────
  const displayList =
    activeTab === 'unread'
      ? notifications.filter((n) => !n.is_read)
      : notifications;

  return (
    <div ref={containerRef} className="relative">
      {/* ── Bell trigger ──────────────────────────────────────────────────── */}
      <button
        type="button"
        id="notification-bell-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative w-9 h-9 rounded-full border border-slate-200 text-slate-600 grid place-items-center hover:bg-slate-100 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ────────────────────────────────────────────────── */}
      {isOpen && (
        <div className="absolute right-0 top-11 w-80 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden">

          {/* Header */}
          <div className="px-4 pt-3 pb-2 border-b border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-900">Notifications</span>
              {activeTab === 'unread' && unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Tab pills */}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('unread')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  activeTab === 'unread'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  activeTab === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {displayList.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                {activeTab === 'unread'
                  ? "You're all caught up."
                  : 'No notifications yet.'}
              </div>
            ) : (
              displayList.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => handleRowClick(notif)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-l-2 ${
                    !notif.is_read
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-white border-transparent'
                  }`}
                >
                  <NotifAvatar
                    photoUrl={notif.actor_photo_url}
                    displayName={notif.actor_display_name}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!notif.is_read ? 'text-slate-900' : 'text-slate-500'}`}>
                      <span className="font-semibold">{notif.actor_display_name}</span>
                      {' replied to your comment'}
                      {notif.article_title ? (
                        <span className="text-slate-400"> on &quot;{notif.article_title}&quot;</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatRelativeTime(notif.created_at)}
                    </p>
                  </div>
                  {!notif.is_read && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
