import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../shared/services/supabaseClient';
import { useNotifications } from '../hooks/useNotifications';

const DEFAULT_NOTIFICATIONS_CONTEXT = {
  notifications: [],
  unreadCount: 0,
  markOneRead: async () => {},
  markAllRead: async () => {},
  deleteNotification: async () => {},
};

const NotificationsContext = createContext(DEFAULT_NOTIFICATIONS_CONTEXT);

export function NotificationsProvider({ children }) {
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    let isActive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (isActive) {
        setCurrentUserId(data?.user?.id || null);
      }
    });
    return () => {
      isActive = false;
    };
  }, []);

  // useNotifications, NotificationBell, and HomeHeader are intentionally unchanged.
  const notificationsValue = useNotifications(currentUserId);

  return (
    <NotificationsContext.Provider value={notificationsValue}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext() {
  const context = useContext(NotificationsContext);
  if (context === DEFAULT_NOTIFICATIONS_CONTEXT) {
    throw new Error('useNotificationsContext must be used within a NotificationsProvider.');
  }
  return context;
}
