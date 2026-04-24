import { Alert } from 'react-native';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  markAllUserNotificationsRead,
  markUserNotificationRead,
  subscribeToUserNotifications,
  type UserNotification,
} from '@/lib/user-notifications';
import { useAuthSession } from '@/providers/auth-provider';

type NotificationContextValue = {
  notifications: UserNotification[];
  loading: boolean;
  unreadCount: number;
  markAllRead: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

function shouldAlertForNotification(
  notification: UserNotification,
  preferences: {
    orderUpdates?: boolean;
    promotions?: boolean;
  } | null | undefined
) {
  if (notification.type === 'promotion') {
    return preferences?.promotions !== false;
  }

  return preferences?.orderUpdates !== false;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { profile, user } = useAuthSession();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      knownNotificationIdsRef.current = new Set();
      hydratedRef.current = false;
      return;
    }

    setLoading(true);
    knownNotificationIdsRef.current = new Set();
    hydratedRef.current = false;

    const unsubscribe = subscribeToUserNotifications(
      user.uid,
      (nextNotifications) => {
        setNotifications(nextNotifications);
        setLoading(false);

        if (!hydratedRef.current) {
          knownNotificationIdsRef.current = new Set(nextNotifications.map((item) => item.id));
          hydratedRef.current = true;
          return;
        }

        const freshNotifications = nextNotifications
          .filter((item) => !knownNotificationIdsRef.current.has(item.id))
          .sort((left, right) => {
            const leftTime =
              typeof left.createdAt === 'object' &&
              left.createdAt !== null &&
              'toMillis' in left.createdAt &&
              typeof left.createdAt.toMillis === 'function'
                ? left.createdAt.toMillis()
                : 0;
            const rightTime =
              typeof right.createdAt === 'object' &&
              right.createdAt !== null &&
              'toMillis' in right.createdAt &&
              typeof right.createdAt.toMillis === 'function'
                ? right.createdAt.toMillis()
                : 0;
            return leftTime - rightTime;
          });

        freshNotifications.forEach((item) => {
          knownNotificationIdsRef.current.add(item.id);
        });

        const newestNotification = freshNotifications[freshNotifications.length - 1];
        if (newestNotification && shouldAlertForNotification(newestNotification, profile?.notificationPreferences)) {
          Alert.alert(newestNotification.title, newestNotification.message);
        }
      },
      () => {
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [profile?.notificationPreferences, user]);

  const unreadCount = notifications.filter((item) => !item.readAt).length;

  const value = useMemo(
    () => ({
      notifications,
      loading,
      unreadCount,
      markAllRead: async () => {
        if (!user) {
          return;
        }

        await markAllUserNotificationsRead(user.uid);
      },
      markRead: async (notificationId: string) => {
        await markUserNotificationRead(notificationId);
      },
    }),
    [loading, notifications, unreadCount, user]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error('useNotifications must be used inside NotificationProvider');
  }

  return context;
}
