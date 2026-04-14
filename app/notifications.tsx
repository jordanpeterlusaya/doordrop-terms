import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CargoHeader, CargoScreen } from '@/components/cargo-ui';
import { cargoTheme } from '@/constants/cargo-theme';

const notifications = [
  {
    id: '1',
    title: 'Driver is close to pickup',
    message: 'Your last courier request is 8 minutes away from the pickup point.',
    time: 'Just now',
    icon: 'truck-fast-outline' as const,
    tint: '#DCFCE7',
    iconColor: '#166534',
  },
  {
    id: '2',
    title: 'Delivery completed',
    message: 'Order DD-20481 was delivered successfully and proof of delivery is available.',
    time: 'Today, 11:40',
    icon: 'check-decagram-outline' as const,
    tint: '#EFF6FF',
    iconColor: '#2563EB',
  },
  {
    id: '3',
    title: 'Promo available',
    message: 'You have a parcel discount for your next in-city delivery this week.',
    time: 'Yesterday',
    icon: 'ticket-percent-outline' as const,
    tint: '#FFF7ED',
    iconColor: '#EA580C',
  },
] as const;

export default function NotificationsScreen() {
  const router = useRouter();

  return (
    <CargoScreen contentContainerStyle={styles.content}>
      <CargoHeader
        title="Notifications"
        subtitle="Delivery updates, dispatch alerts and account activity."
        onLeftPress={() => router.back()}
      />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Stay in sync</Text>
        <Text style={styles.summaryText}>
          Important delivery activity, driver ETA updates and support messages appear here.
        </Text>
      </View>

      <View style={styles.listCard}>
        {notifications.map((item, index) => (
          <View key={item.id} style={[styles.itemRow, index !== notifications.length - 1 && styles.itemBorder]}>
            <View style={[styles.iconWrap, { backgroundColor: item.tint }]}>
              <MaterialCommunityIcons name={item.icon} size={20} color={item.iconColor} />
            </View>
            <View style={styles.itemCopy}>
              <View style={styles.itemTop}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemTime}>{item.time}</Text>
              </View>
              <Text style={styles.itemMessage}>{item.message}</Text>
            </View>
          </View>
        ))}
      </View>
    </CargoScreen>
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
});
