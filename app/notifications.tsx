import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AuthNotificationBoundary } from '@/components/auth/session-boundary';
import { CargoHeader, CargoScreen } from '@/components/cargo-ui';
import { cargoTheme } from '@/constants/cargo-theme';
import { formatDeliveryDateTime, getDeliveryOrderStatusLabel, type DeliveryOrderStatus } from '@/lib/delivery-data';
import { useNotifications } from '@/providers/notification-provider';

function getNotificationPresentation(input: {
  type: 'order_created' | 'order_status' | 'promotion';
  orderStatus?: DeliveryOrderStatus;
}) {
  if (input.type === 'promotion') {
    return {
      icon: 'ticket-percent-outline' as const,
      tint: '#FFF7ED',
      iconColor: '#EA580C',
    };
  }

  if (input.type === 'order_created') {
    return {
      icon: 'clipboard-check-outline' as const,
      tint: '#ECFDF3',
      iconColor: '#166534',
    };
  }

  if (input.orderStatus === 'delivered') {
    return {
      icon: 'check-decagram-outline' as const,
      tint: '#EFF6FF',
      iconColor: '#2563EB',
    };
  }

  if (input.orderStatus === 'cancelled') {
    return {
      icon: 'close-circle-outline' as const,
      tint: '#FEF2F2',
      iconColor: '#DC2626',
    };
  }

  return {
    icon: 'truck-fast-outline' as const,
    tint: '#DCFCE7',
    iconColor: '#166534',
  };
}

function NotificationsScreenContent() {
  const router = useRouter();
  const { loading, markAllRead, markRead, notifications, unreadCount } = useNotifications();

  useEffect(() => {
    if (!loading && unreadCount > 0) {
      void markAllRead();
    }
  }, [loading, markAllRead, unreadCount]);

  return (
    <CargoScreen contentContainerStyle={styles.content}>
      <CargoHeader
        title="Notifications"
        subtitle="Delivery updates, dispatch alerts and account activity."
        onLeftPress={() => router.back()}
      />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{unreadCount > 0 ? `${unreadCount} new update${unreadCount === 1 ? '' : 's'}` : 'Stay in sync'}</Text>
        <Text style={styles.summaryText}>
          {unreadCount > 0
            ? 'Your latest order activity is ready below and will keep updating automatically.'
            : 'Important delivery activity, driver ETA updates and support messages appear here.'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={cargoTheme.colors.primary} />
          <Text style={styles.emptyTitle}>Loading notifications</Text>
          <Text style={styles.emptyText}>We are pulling your latest order alerts from Firestore.</Text>
        </View>
      ) : null}

      {!loading && !notifications.length ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="bell-outline" size={30} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>When dispatch updates your order, it will appear here automatically.</Text>
        </View>
      ) : null}

      {!loading && notifications.length ? (
        <View style={styles.listCard}>
          {notifications.map((item, index) => {
            const presentation = getNotificationPresentation({
              type: item.type,
              orderStatus: item.orderStatus,
            });

            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.88}
                style={[styles.itemRow, index !== notifications.length - 1 && styles.itemBorder, !item.readAt && styles.itemUnread]}
                onPress={() => {
                  void markRead(item.id);

                  if (item.orderId) {
                    router.push({
                      pathname: '/track-order',
                      params: { orderId: item.orderId },
                    });
                  }
                }}>
                <View style={[styles.iconWrap, { backgroundColor: presentation.tint }]}>
                  <MaterialCommunityIcons name={presentation.icon} size={20} color={presentation.iconColor} />
                </View>
                <View style={styles.itemCopy}>
                  <View style={styles.itemTop}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemTime}>{formatDeliveryDateTime(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.itemMessage}>{item.message}</Text>
                  {item.orderStatus ? (
                    <Text style={styles.itemMeta}>
                      {getDeliveryOrderStatusLabel(item.orderStatus)}
                      {item.orderNumber ? ` • ${item.orderNumber}` : ''}
                    </Text>
                  ) : item.orderNumber ? (
                    <Text style={styles.itemMeta}>{item.orderNumber}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </CargoScreen>
  );
}

export default function NotificationsScreen() {
  return (
    <AuthNotificationBoundary>
      <NotificationsScreenContent />
    </AuthNotificationBoundary>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: cargoTheme.colors.darkSurface,
    borderRadius: 28,
    padding: 20,
    marginBottom: 18,
  },
  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  summaryText: {
    color: '#D6E0EA',
    fontSize: 14,
    lineHeight: 21,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: cargoTheme.colors.text,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    color: cargoTheme.colors.subtext,
  },
  listCard: {
    backgroundColor: cargoTheme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 18,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  itemUnread: {
    backgroundColor: '#F8FAFC',
    marginHorizontal: -18,
    paddingHorizontal: 18,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCopy: {
    flex: 1,
    gap: 5,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemTitle: {
    flex: 1,
    color: cargoTheme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  itemTime: {
    color: cargoTheme.colors.subtext,
    fontSize: 12,
    fontWeight: '600',
  },
  itemMessage: {
    color: cargoTheme.colors.subtext,
    fontSize: 13,
    lineHeight: 19,
  },
  itemMeta: {
    color: cargoTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
});
