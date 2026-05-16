// frontend/src/features/news/hooks/useArticleComments.js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../shared/services/supabaseClient';

const COMMENT_LIMIT = 2000;

function getDisplayName(user) {
  const firstName = (user?.user_metadata?.first_name || '').trim();
  const lastName  = (user?.user_metadata?.last_name  || '').trim();
  const combined  = `${firstName} ${lastName}`.trim();
  if (combined) return combined;
  const email = (user?.email || '').trim();
  if (email) return email.split('@')[0];
  return 'NewsHub User';
}

function sortByCreatedAt(list) {
  return [...list].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

const SELECT_COLS =
  'id, article_id, user_id, display_name, content, created_at, parent_id, profile_photo_url';

/**
 * Loads and manages real-time comments (flat + threaded) for a specific article.
 *
 * @param {string | number} articleId
 * @param {string}          [articleTitle='']  Used when inserting reply notifications.
 */
export function useArticleComments(articleId, articleTitle = '') {
  const [comments,    setComments]    = useState([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Cache the current user's profile_photo_url after first lookup.
  // null  = not yet fetched
  // ''    = fetched, no URL
  // str   = fetched URL
  const photoUrlCacheRef = useRef(null);

  // ── Resolve article id ───────────────────────────────────────────────────
  const resolvedArticleId = useMemo(() => {
    if (articleId === null || articleId === undefined || articleId === '') return null;
    const numeric = Number(articleId);
    return Number.isNaN(numeric) ? null : numeric;
  }, [articleId]);

  // ── Auth user ────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      setCurrentUser(data?.user || null);
    };
    loadUser();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setCurrentUser(session?.user || null);
      // Reset photo cache on auth change so fresh user gets their own URL.
      photoUrlCacheRef.current = null;
    });

    return () => {
      isMounted = false;
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

  // ── Load comments + realtime channel ────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    setError(null);

    if (resolvedArticleId === null) {
      setComments([]);
      setIsLoading(false);
      return () => { isMounted = false; };
    }

    const loadComments = async () => {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('article_comments')
        .select(SELECT_COLS)
        .eq('article_id', resolvedArticleId)
        .order('created_at', { ascending: true });

      if (!isMounted) return;
      if (fetchError) {
        setError(fetchError.message || 'Unable to load comments.');
        setComments([]);
      } else {
        setComments(data || []);
      }
      setIsLoading(false);
    };

    loadComments();

    const channel = supabase
      .channel(`article-comments-${resolvedArticleId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'article_comments',
          filter: `article_id=eq.${resolvedArticleId}`,
        },
        (payload) => {
          const next = payload?.new;
          if (!next?.id) return;
          setComments((prev) => {
            if (prev.some((c) => c.id === next.id)) return prev;
            return sortByCreatedAt([...prev, next]);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event:  'DELETE',
          schema: 'public',
          table:  'article_comments',
          filter: `article_id=eq.${resolvedArticleId}`,
        },
        (payload) => {
          const removed = payload?.old;
          if (!removed?.id) return;
          setComments((prev) => prev.filter((c) => c.id !== removed.id));
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [resolvedArticleId]);

  // ── submitComment ────────────────────────────────────────────────────────
  /**
   * @param {string}      content
   * @param {number|null} [parentId=null]  Set for replies; null for top-level.
   */
  const submitComment = useCallback(
    async (content, parentId = null) => {
      if (!currentUser) {
        const msg = 'Please sign in to post a comment.';
        setError(msg);
        return Promise.reject(msg);
      }
      if (resolvedArticleId === null) {
        const msg = 'Article id is missing.';
        setError(msg);
        return Promise.reject(msg);
      }

      const trimmed = String(content || '').trim();
      if (!trimmed) {
        const msg = 'Comment cannot be empty.';
        setError(msg);
        return Promise.reject(msg);
      }
      if (trimmed.length > COMMENT_LIMIT) {
        const msg = `Comments must be ${COMMENT_LIMIT} characters or fewer.`;
        setError(msg);
        return Promise.reject(msg);
      }

      setError(null);
      const displayName = getDisplayName(currentUser);

      // ── Fetch (and cache) the commenter's profile photo URL ──────────────
      let photoUrl = '';
      if (photoUrlCacheRef.current === null) {
        const { data: userRow } = await supabase
          .from('users')
          .select('profile_photo_url')
          .eq('email', currentUser.email)
          .maybeSingle();
        photoUrl = userRow?.profile_photo_url || '';
        photoUrlCacheRef.current = photoUrl;
      } else {
        photoUrl = photoUrlCacheRef.current;
      }

      // ── Insert comment row ───────────────────────────────────────────────
      const { data, error: insertError } = await supabase
        .from('article_comments')
        .insert({
          article_id:        resolvedArticleId,
          user_id:           currentUser.id,
          display_name:      displayName,
          content:           trimmed,
          parent_id:         parentId || null,
          profile_photo_url: photoUrl || null,
        })
        .select(SELECT_COLS)
        .single();

      if (insertError) {
        const msg = insertError.message || 'Unable to post comment.';
        setError(msg);
        return Promise.reject(msg);
      }

      if (data?.id) {
        setComments((prev) => {
          if (prev.some((c) => c.id === data.id)) return prev;
          return sortByCreatedAt([...prev, data]);
        });
      }

      // ── Insert reply notification (fire-and-forget) ──────────────────────
      if (parentId !== null && data?.id) {
        // Read latest comments state via functional updater trick (ref snapshot).
        setComments((prev) => {
          const parentComment = prev.find((c) => c.id === parentId);
          if (parentComment && parentComment.user_id !== currentUser.id) {
            supabase
              .from('notifications')
              .insert({
                recipient_user_id:  parentComment.user_id,
                actor_user_id:      currentUser.id,
                actor_display_name: displayName,
                actor_photo_url:    photoUrl || null,
                comment_id:         data.id,
                article_id:         resolvedArticleId,
                article_title:      articleTitle || '',
                is_read:            false,
              })
              .then(({ error: notifErr }) => {
                if (notifErr) {
                  console.warn('Notification insert failed:', notifErr.message);
                }
              });
          }
          return prev; // no state change — this is just a read trick
        });
      }

      return data;
    },
    [currentUser, resolvedArticleId, articleTitle]
  );

  // ── deleteComment ────────────────────────────────────────────────────────
  const deleteComment = useCallback(async (commentId) => {
    if (!commentId) return Promise.resolve();
    setError(null);
    const { error: deleteError } = await supabase
      .from('article_comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      const msg = deleteError.message || 'Unable to delete comment.';
      setError(msg);
      return Promise.reject(msg);
    }
    return Promise.resolve();
  }, []);

  return {
    comments,
    commentCount: comments.length,
    isLoading,
    error,
    currentUser,
    submitComment,
    deleteComment,
  };
}
