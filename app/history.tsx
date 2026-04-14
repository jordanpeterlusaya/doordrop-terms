import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BottomNav, CargoHeader, CargoScreen, SectionHeader } from '@/components/cargo-ui';
import { cargoTheme, historyOrders } from '@/constants/cargo-theme';

const filters = ['All', 'Parcel', 'Cargo'] as const;

export default function HistoryScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>('All');

  const orders = historyOrders.filter((order) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Parcel') return order.type.toLowerCase().includes('parcel');
    return !order.type.toLowerCase().includes('parcel');
  });

  return (
    <CargoScreen
      contentContainerStyle={styles.content}
      footer={<BottomNav activeTab="history" />}>
      <CargoHeader
        title="History"
        subtitle="Review past deliveries, repeat previous routes and monitor your order patterns."
        leftAction="menu"
        onLeftPress={() => router.push('/menu')}
        rightIcon="map-marker-path"
        onRightPress={() => router.push('/track-order')}
      />

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>24</Text>
          <Text style={styles.statLabel}>Orders this month</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>91%</Text>
          <Text style={styles.statLabel}>On-time delivery</Text>
        </View>
      </View>

      <SectionHeader title="Filter orders" />
      <View style={styles.filterRow}>
        {filters.map((filter) => {
          const isActive = filter === activeFilter;
          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}>
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{filter}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <SectionHeader title="Recent orders" />
      {orders.map((order) => (
        <TouchableOpacity
          key={order.id}
          style={styles.orderCard}
          activeOpacity={0.88}
          onPress={() => router.push('/track-order')}>
          <View style={styles.orderLeading}>
            <View style={styles.orderIconWrap}>
              <MaterialCommunityIcons
                name={order.type.toLowerCase().includes('parcel') ? 'package-variant-closed' : 'truck-fast-outline'}
                size={20}
                color={cargoTheme.colors.text}
              />
            </View>
            <View style={styles.orderCopy}>
              <Text style={styles.orderTitle}>{order.type}</Text>
              <Text style={styles.orderRoute}>{order.route}</Text>
              <Text style={styles.orderMeta}>
                {order.id} • {order.time}
              </Text>
            </View>
          </View>
          <View style={styles.orderTrailing}>
            <Text style={styles.orderAmount}>{order.amount}</Text>
            <Text style={[styles.orderStatus, order.status === 'Canceled' && styles.orderStatusCanceled]}>
              {order.status}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </CargoScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    backgroundColor: cargoTheme.colors.darkSurface,
    borderRadius: 24,
    padding: 18,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 18,
    color: '#D7E1EA',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: cargoTheme.colors.surface,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
  },
  filterChipActive: {
    backgroundColor: '#ECFDF3',
    borderColor: '#BBF7D0',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
    color: cargoTheme.colors.text,
  },
  filterTextActive: {
    color: cargoTheme.colors.primaryDark,
  },
  orderCard: {
    backgroundColor: cargoTheme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderLeading: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 12,
  },
  orderIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  orderCopy: {
    flex: 1,
  },
  orderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 4,
  },
  orderRoute: {
    fontSize: 12,
    lineHeight: 18,
    color: cargoTheme.colors.subtext,
    marginBottom: 4,
  },
  orderMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  orderTrailing: {
    alignItems: 'flex-end',
  },
  orderAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 6,
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: cargoTheme.colors.primaryDark,
  },
  orderStatusCanceled: {
    color: cargoTheme.colors.warning,
  },
});
