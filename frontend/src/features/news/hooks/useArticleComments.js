import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../shared/services/supabaseClient';

const COMMENT_LIMIT = 2000;

function getDisplayName(user) {
  const firstName = (user?.user_metadata?.first_name || '').trim();
  const lastName = (user?.user_metadata?.last_name || '').trim();
  const combined = `${firstName} ${lastName}`.trim();
  if (combined) {
    return combined;
  }

  const email = (user?.email || '').trim();
  if (email) {
    return email.split('@')[0];
  }

  return 'NewsHub User';
}

function sortByCreatedAt(list) {
  return [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/**
 * Loads and manages real-time comments for a specific article.
 * @param {string | number} articleId
 * @returns {{
 *  comments: Array<{id: string, display_name: string, content: string, created_at: string, user_id: string}>,
 *  commentCount: number,
 *  isLoading: boolean,
 *  error: string | null,
 *  currentUser: any | null,
 *  submitComment: (content: string) => Promise<any>,
 *  deleteComment: (commentId: string) => Promise<any>
 * }}
 */
export function useArticleComments(articleId) {
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const resolvedArticleId = useMemo(() => {
    if (articleId === null || articleId === undefined || articleId === '') {
      return null;
    }
    const numeric = Number(articleId);
    return Number.isNaN(numeric) ? null : numeric;
  }, [articleId]);

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
    });

    return () => {
      isMounted = false;
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setError(null);

    if (resolvedArticleId === null) {
      setComments([]);
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const loadComments = async () => {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('article_comments')
        .select('id, article_id, user_id, display_name, content, created_at')
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
          event: 'INSERT',
          schema: 'public',
          table: 'article_comments',
          filter: `article_id=eq.${resolvedArticleId}`,
        },
        (payload) => {
          const next = payload?.new;
          if (!next?.id) {
            return;
          }
          setComments((prev) => {
            if (prev.some((comment) => comment.id === next.id)) {
              return prev;
            }
            return sortByCreatedAt([...prev, next]);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'article_comments',
          filter: `article_id=eq.${resolvedArticleId}`,
        },
        (payload) => {
          const removed = payload?.old;
          if (!removed?.id) {
            return;
          }
          setComments((prev) => prev.filter((comment) => comment.id !== removed.id));
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [resolvedArticleId]);

  const submitComment = useCallback(
    async (content) => {
      if (!currentUser) {
        const message = 'Please sign in to post a comment.';
        setError(message);
        return Promise.reject(message);
      }

      if (resolvedArticleId === null) {
        const message = 'Article id is missing.';
        setError(message);
        return Promise.reject(message);
      }

      const trimmed = String(content || '').trim();
      if (!trimmed) {
        const message = 'Comment cannot be empty.';
        setError(message);
        return Promise.reject(message);
      }

      if (trimmed.length > COMMENT_LIMIT) {
        const message = `Comments must be ${COMMENT_LIMIT} characters or fewer.`;
        setError(message);
        return Promise.reject(message);
      }

      setError(null);
      const displayName = getDisplayName(currentUser);
      const { data, error: insertError } = await supabase
        .from('article_comments')
        .insert({
          article_id: resolvedArticleId,
          user_id: currentUser.id,
          display_name: displayName,
          content: trimmed,
        })
        .select('id, article_id, user_id, display_name, content, created_at')
        .single();

      if (insertError) {
        const message = insertError.message || 'Unable to post comment.';
        setError(message);
        return Promise.reject(message);
      }

      if (data?.id) {
        setComments((prev) => {
          if (prev.some((comment) => comment.id === data.id)) {
            return prev;
          }
          return sortByCreatedAt([...prev, data]);
        });
      }

      return data;
    },
    [currentUser, resolvedArticleId]
  );

  const deleteComment = useCallback(async (commentId) => {
    if (!commentId) {
      return Promise.resolve();
    }

    setError(null);
    const { error: deleteError } = await supabase
      .from('article_comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      const message = deleteError.message || 'Unable to delete comment.';
      setError(message);
      return Promise.reject(message);
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
