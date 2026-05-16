// frontend/src/features/news/hooks/useNotifications.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../shared/services/supabaseClient';

/**
 * Manages live notifications for the authenticated user.
 *
 * @param {string | null} currentUserId  auth.uid() of the current user.
 * @returns {{
 *   notifications: Array,
 *   unreadCount: number,
 *   markOneRead: (id: number) => Promise<void>,
 *   markAllRead: () => Promise<void>,
 * }}
 */
export function useNotifications(currentUserId) {
  const [notifications, setNotifications] = useState([]);

  // ── Initial fetch + Realtime subscription ────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;

    let isMounted = true;

    const load = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', currentUserId)
        .order('created_at', { ascending: false });

      if (!isMounted) return;
      if (!error) setNotifications(data || []);
    };

    load();

    const channel = supabase
      .channel(`notifications-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `recipient_user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const next = payload?.new;
          if (!next?.id) return;
          setNotifications((prev) => {
            if (prev.some((n) => n.id === next.id)) return prev;
            return [next, ...prev]; // newest first
          });
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // ── markOneRead ──────────────────────────────────────────────────────────
  const markOneRead = useCallback(async (id) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      // Revert on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: false } : n))
      );
      console.warn('markOneRead failed:', error.message);
    }
  }, []);

  // ── markAllRead ──────────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    if (!currentUserId) return;

    // Optimistic
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_user_id', currentUserId)
      .eq('is_read', false);

    if (error) {
      // Refetch to restore true state
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', currentUserId)
        .order('created_at', { ascending: false });
      if (data) setNotifications(data);
      console.warn('markAllRead failed:', error.message);
    }
  }, [currentUserId]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  return { notifications, unreadCount, markOneRead, markAllRead };
}
