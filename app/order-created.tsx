import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { CargoHeader, CargoScreen, PrimaryButton, SummaryRow } from '@/components/cargo-ui';
import { cargoTheme } from '@/constants/cargo-theme';
import {
  formatDeliveryDateTime,
  getDeliveryOrderStatusLabel,
  subscribeToOrder,
  type DeliveryOrder,
} from '@/lib/delivery-data';

function getParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function OrderCreatedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const orderId = getParamValue(params.orderId);
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) {
      setError('We could not find the order you just created.');
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToOrder(
      orderId,
      (nextOrder) => {
        setOrder(nextOrder);
        setLoading(false);
      },
      () => {
        setError('We could not load this order right now.');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [orderId]);

  const driverInitials = useMemo(() => {
    const source = order?.driverName?.trim();
    if (!source) {
      return 'DD';
    }

    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }, [order?.driverName]);

  if (loading) {
    return (
      <CargoScreen contentContainerStyle={styles.centered}>
        <ActivityIndicator size="large" color={cargoTheme.colors.primary} />
        <Text style={styles.centerText}>Saving your order into DoorDrop dispatch...</Text>
      </CargoScreen>
    );
  }

  if (!order) {
    return (
      <CargoScreen contentContainerStyle={styles.centered}>
        <MaterialCommunityIcons name="alert-circle-outline" size={34} color="#DC2626" />
        <Text style={styles.centerText}>{error || 'This order is not available anymore.'}</Text>
        <PrimaryButton label="Back to home" variant="secondary" onPress={() => router.replace('/home')} />
      </CargoScreen>
    );
  }

  const isAssigned = !!order.driverId;

  return (
    <CargoScreen contentContainerStyle={styles.content}>
      <CargoHeader
        title="Order created"
        subtitle={isAssigned ? 'Dispatch has already linked a driver to this order.' : 'Dispatch received your order and is assigning the best driver now.'}
        onLeftPress={() => router.replace('/home')}
        leftAction="close"
      />

      <View style={styles.successCard}>
        <View style={styles.successIconWrap}>
          <MaterialCommunityIcons
            name={isAssigned ? 'check' : 'clock-outline'}
            size={34}
            color={cargoTheme.colors.primaryDark}
          />
        </View>
        <Text style={styles.successTitle}>{isAssigned ? 'Driver matched successfully' : 'Order sent to dispatch'}</Text>
        <Text style={styles.successText}>
          {isAssigned
            ? `${order.driverName} has been assigned and the order is ready for live tracking.`
            : 'Your order is now with DoorDrop dispatch, where the next available driver can be assigned.'}
        </Text>
      </View>

      <View style={styles.driverCard}>
        <View style={styles.driverTop}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverAvatarText}>{driverInitials}</Text>
          </View>
          <View style={styles.driverCopy}>
            <Text style={styles.driverName}>{isAssigned ? order.driverName : 'Waiting for driver assignment'}</Text>
            <Text style={styles.driverMeta}>
              {isAssigned
                ? `${order.driverVehicleLabel} • ${order.driverPlateNumber || 'Plate pending'}`
                : 'DoorDrop dispatch can assign a driver at any time.'}
            </Text>
          </View>
        </View>

        <SummaryRow label="Order ID" value={order.orderNumber} />
        <SummaryRow label="Status" value={getDeliveryOrderStatusLabel(order.status)} />
        <SummaryRow label="Created" value={formatDeliveryDateTime(order.createdAt)} />
        <SummaryRow label="Contact" value={isAssigned ? order.driverPhone || 'Phone pending' : 'Will appear after assignment'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Order summary</Text>
        <SummaryRow label="Service" value={order.serviceLabel} />
        <SummaryRow label="Pickup" value={order.pickupLabel} />
        <SummaryRow label="Drop-off" value={order.dropoffLabel} />
        <SummaryRow label="Estimated total" value={order.totalLabel} emphasis />
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>What happens next</Text>
        <Text style={styles.tipText}>1. The order is visible to DoorDrop dispatch.</Text>
        <Text style={styles.tipText}>2. DoorDrop assigns a driver and updates the order status in Firestore.</Text>
        <Text style={styles.tipText}>3. Your app receives the new driver information and live status automatically.</Text>
      </View>

      <PrimaryButton
        label="Track this order"
        icon="map-marker-path"
        onPress={() =>
          router.replace({
            pathname: '/track-order',
            params: { orderId: order.id },
          })
        }
        style={styles.primaryAction}
      />
      <PrimaryButton label="Back to home" variant="secondary" onPress={() => router.replace('/home')} />
    </CargoScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
  centered: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  centerText: {
    maxWidth: 280,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: cargoTheme.colors.subtext,
  },
  successCard: {
    backgroundColor: cargoTheme.colors.darkSurface,
    borderRadius: 28,
    padding: 22,
    alignItems: 'center',
    marginBottom: 22,
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  successText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#D7E1EA',
    textAlign: 'center',
  },
  driverCard: {
    backgroundColor: cargoTheme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    padding: 18,
    marginBottom: 16,
  },
  driverTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: cargoTheme.colors.primaryDark,
  },
  driverCopy: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 4,
  },
  driverMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: cargoTheme.colors.subtext,
  },
  card: {
    backgroundColor: cargoTheme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    padding: 18,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 14,
  },
  tipCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    marginBottom: 20,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 10,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 20,
    color: cargoTheme.colors.subtext,
    marginBottom: 4,
  },
  primaryAction: {
    marginBottom: 10,
  },
});
