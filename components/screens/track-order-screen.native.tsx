import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { BottomNav, PrimaryButton } from '@/components/cargo-ui';
import { cargoTheme } from '@/constants/cargo-theme';
import {
  cancelDeliveryOrderByUser,
  formatDeliveryDateTime,
  getDeliveryOrderStatusLabel,
  subscribeToOrder,
  type DeliveryOrder,
  type DeliveryOrderStatus,
} from '@/lib/delivery-data';

const { height } = Dimensions.get('window');

const statusRank: Record<DeliveryOrderStatus, number> = {
  pending_assignment: 0,
  driver_assigned: 1,
  driver_at_pickup: 2,
  in_transit: 3,
  delivered: 4,
  cancelled: 4,
};

const cancellationReasons = [
  'I entered the wrong pickup or drop-off details',
  'The price is higher than expected',
  'I no longer need this delivery',
  'I want to change the vehicle or service type',
  'Pickup is taking too long',
] as const;

function getParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getDialablePhoneNumber(phone?: string) {
  if (!phone) {
    return '';
  }

  const trimmed = phone.trim();
  const hasPlusPrefix = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/[^\d]/g, '');

  return hasPlusPrefix ? `+${digitsOnly}` : digitsOnly;
}

function interpolatePoint(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number },
  progress: number
) {
  return {
    latitude: start.latitude + (end.latitude - start.latitude) * progress,
    longitude: start.longitude + (end.longitude - start.longitude) * progress,
  };
}

function getFallbackDropoff(start: { latitude: number; longitude: number }) {
  return {
    latitude: start.latitude + 0.014,
    longitude: start.longitude + 0.019,
  };
}

function getTrackingTitle(order: DeliveryOrder) {
  if (order.status === 'pending_assignment') {
    return 'Dispatch is matching your driver';
  }

  if (order.status === 'driver_assigned') {
    return order.flow === 'cargo' ? 'Cargo driver is heading to pickup' : 'Parcel rider is heading to pickup';
  }

  if (order.status === 'driver_at_pickup') {
    return 'Driver has arrived at pickup';
  }

  if (order.status === 'in_transit') {
    return order.flow === 'cargo' ? 'Cargo is now on the move' : 'Parcel is now on the move';
  }

  if (order.status === 'delivered') {
    return 'Order delivered successfully';
  }

  return 'This order was cancelled';
}

function getCancellationActorLabel(cancelledBy?: DeliveryOrder['cancelledBy']) {
  if (cancelledBy === 'customer') {
    return 'Customer';
  }

  if (cancelledBy === 'driver') {
    return 'Driver';
  }

  if (cancelledBy === 'dispatch') {
    return 'Dispatch';
  }

  return 'DoorDrop';
}

export default function TrackOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const orderId = getParamValue(params.orderId);
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelPanel, setShowCancelPanel] = useState(false);
  const [cancelReason, setCancelReason] = useState<(typeof cancellationReasons)[number] | ''>('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToOrder(orderId, (nextOrder) => {
      setOrder(nextOrder);
      setLoading(false);
    });

    return unsubscribe;
  }, [orderId]);

  const pickupPoint = useMemo(() => {
    if (order?.pickupLatitude !== undefined && order.pickupLongitude !== undefined) {
      return {
        latitude: order.pickupLatitude,
        longitude: order.pickupLongitude,
      };
    }

    return {
      latitude: -6.7924,
      longitude: 39.2083,
    };
  }, [order?.pickupLatitude, order?.pickupLongitude]);

  const dropoffPoint = useMemo(() => {
    if (order?.dropoffLatitude !== undefined && order.dropoffLongitude !== undefined) {
      return {
        latitude: order.dropoffLatitude,
        longitude: order.dropoffLongitude,
      };
    }

    return getFallbackDropoff(pickupPoint);
  }, [order?.dropoffLatitude, order?.dropoffLongitude, pickupPoint]);

  const driverPoint = useMemo(() => {
    if (order?.driverLatitude !== undefined && order.driverLongitude !== undefined) {
      return {
        latitude: order.driverLatitude,
        longitude: order.driverLongitude,
      };
    }

    if (!order?.driverId) {
      return null;
    }

    const progressByStatus: Record<DeliveryOrderStatus, number> = {
      pending_assignment: 0,
      driver_assigned: 0.18,
      driver_at_pickup: 0.04,
      in_transit: 0.58,
      delivered: 0.98,
      cancelled: 0.12,
    };

    return interpolatePoint(pickupPoint, dropoffPoint, progressByStatus[order.status]);
  }, [dropoffPoint, order?.driverId, order?.driverLatitude, order?.driverLongitude, order?.status, pickupPoint]);
  const routePoints = driverPoint ? [pickupPoint, driverPoint, dropoffPoint] : [pickupPoint, dropoffPoint];
  const progressSteps = order
    ? [
        { title: 'Order received', note: 'Dispatch received the booking from your app.', active: true },
        {
          title: 'Driver assigned',
          note: 'A driver is chosen by DoorDrop dispatch and linked to your order.',
          active: statusRank[order.status] >= statusRank.driver_assigned,
        },
        {
          title: 'Driver at pickup',
          note: 'Pickup checks happen before the trip starts.',
          active: statusRank[order.status] >= statusRank.driver_at_pickup,
        },
        {
          title: 'In transit',
          note: 'The order is on the road to the destination.',
          active: statusRank[order.status] >= statusRank.in_transit,
        },
        {
          title: 'Delivered',
          note: 'Trip is completed and marked delivered by dispatch.',
          active: statusRank[order.status] >= statusRank.delivered,
        },
      ]
    : [];
  const driverPhone = order?.driverPhone?.trim() || '';
  const hasDriverPhone = driverPhone.length > 0;
  const canCancelOrder = !!order && !['delivered', 'cancelled'].includes(order.status);
  const cancellationReason = order?.cancellationReason?.trim() || '';

  const handleCallDriver = async () => {
    if (!hasDriverPhone) {
      Alert.alert('Driver phone pending', 'The driver number will appear here as soon as dispatch assigns or updates it.');
      return;
    }

    const dialablePhone = getDialablePhoneNumber(driverPhone);
    const callUrl = `tel:${dialablePhone}`;

    try {
      const supported = await Linking.canOpenURL(callUrl);
      if (!supported) {
        throw new Error('Phone calls are not available on this device.');
      }

      await Linking.openURL(callUrl);
    } catch {
      Alert.alert('Unable to place call', `Try calling the driver directly on ${driverPhone}.`);
    }
  };

  const handleShareTrip = async () => {
    if (!order) {
      return;
    }

    const shareMessage = [
      `DoorDrop trip ${order.orderNumber}`,
      `${order.pickupLabel} to ${order.dropoffLabel}`,
      `Status: ${getDeliveryOrderStatusLabel(order.status)}`,
      order.driverName ? `Driver: ${order.driverName}` : '',
      driverPhone ? `Phone: ${driverPhone}` : '',
      `Fare: ${order.totalLabel}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await Share.share({
        title: order.orderNumber,
        message: shareMessage,
      });
    } catch {
      Alert.alert('Unable to share trip', 'Please try sharing this tracking update again.');
    }
  };

  const handleSubmitCancelOrder = () => {
    if (!order || !canCancelOrder || cancelSubmitting) {
      return;
    }

    const trimmedReason = cancelReason.trim();
    if (trimmedReason.length < 4) {
      Alert.alert('Reason required', 'Please choose a cancellation reason before submitting.');
      return;
    }

    Alert.alert('Cancel this order?', `Reason: ${trimmedReason}`, [
      { text: 'Keep order', style: 'cancel' },
      {
        text: 'Cancel order',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              setCancelSubmitting(true);
              await cancelDeliveryOrderByUser(order.id, trimmedReason);
              setShowCancelPanel(false);
              setCancelReason('');
            } catch (error) {
              Alert.alert(
                'Unable to cancel order',
                error instanceof Error ? error.message : 'Please try cancelling this order again.'
              );
            } finally {
              setCancelSubmitting(false);
            }
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: (pickupPoint.latitude + dropoffPoint.latitude) / 2,
            longitude: (pickupPoint.longitude + dropoffPoint.longitude) / 2,
            latitudeDelta: 0.04,
            longitudeDelta: 0.03,
          }}>
          <Marker coordinate={pickupPoint} title="Pickup" description={order?.pickupLabel ?? 'Pickup location'} />
          <Marker coordinate={dropoffPoint} title="Destination" description={order?.dropoffLabel ?? 'Destination'} />
          {driverPoint ? (
            <Marker
              coordinate={driverPoint}
              title={order?.driverName ?? 'Driver'}
              description={
                order?.driverLocationUpdatedAt
                  ? `Live location updated ${formatDeliveryDateTime(order.driverLocationUpdatedAt)}`
                  : order?.driverVehicleLabel ?? 'Assigned driver'
              }
              pinColor={cargoTheme.colors.primary}
            />
          ) : null}
          <Polyline coordinates={routePoints} strokeColor={cargoTheme.colors.primary} strokeWidth={4} />
        </MapView>

        <View style={styles.mapShade} />

        <View style={styles.topBar}>
          <TouchableOpacity style={styles.chromeButton} onPress={() => router.push('/menu')}>
            <MaterialCommunityIcons name="menu" size={22} color={cargoTheme.colors.text} />
          </TouchableOpacity>
          <View style={styles.titleChip}>
            <Text style={styles.titleChipText}>Live tracking</Text>
          </View>
          <TouchableOpacity style={styles.chromeButton}>
            <MaterialCommunityIcons name="headset" size={22} color={cargoTheme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          {!order && !loading ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="map-marker-question-outline" size={30} color="#94A3B8" />
              <Text style={styles.emptyTitle}>Order not found</Text>
              <Text style={styles.emptyText}>Open a recent order from history or create a new booking first.</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="progress-clock" size={30} color={cargoTheme.colors.primary} />
              <Text style={styles.emptyTitle}>Loading live order data</Text>
              <Text style={styles.emptyText}>We are pulling the latest dispatch status from Firestore.</Text>
            </View>
          ) : null}

          {order ? (
            <>
              <View style={styles.statusCard}>
                <View style={styles.statusBadge}>
                  <MaterialCommunityIcons
                    name={order.status === 'pending_assignment' ? 'clock-outline' : 'map-marker-path'}
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.statusBadgeText}>{getDeliveryOrderStatusLabel(order.status)}</Text>
                </View>
                <Text style={styles.statusTitle}>{getTrackingTitle(order)}</Text>
                <Text style={styles.statusText}>
                  {order.driverId
                    ? `${order.driverName} is linked to this order and updates will appear here${order.driverLocationUpdatedAt ? ` with live location from ${formatDeliveryDateTime(order.driverLocationUpdatedAt)}` : ' as the trip moves forward'}.`
                    : 'The order is visible to DoorDrop dispatch and is waiting for a driver assignment.'}
                </Text>
              </View>

              <View style={styles.driverCard}>
                <View style={styles.driverTop}>
                  <View style={styles.driverAvatar}>
                    <Text style={styles.driverAvatarText}>
                      {(order.driverName ?? 'DD')
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase() ?? '')
                        .join('')}
                    </Text>
                  </View>
                  <View style={styles.driverCopy}>
                    <Text style={styles.driverName}>{order.driverName || 'Driver not assigned yet'}</Text>
                    <Text style={styles.driverMeta}>
                      {order.driverId
                        ? `${order.driverVehicleLabel || 'Vehicle pending'} • ${order.driverPlateNumber || 'Plate pending'}`
                        : 'Dispatch will assign the nearest available driver soon.'}
                    </Text>
                  </View>
                  <View style={styles.ratingWrap}>
                    <MaterialCommunityIcons name="star" size={14} color="#F59E0B" />
                    <Text style={styles.ratingText}>{order.driverId ? '4.9' : '--'}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={hasDriverPhone ? 0.88 : 1}
                  onPress={() => {
                    void handleCallDriver();
                  }}
                  style={[styles.phoneCard, !hasDriverPhone && styles.phoneCardMuted]}>
                  <View style={styles.phoneCardLeading}>
                    <MaterialCommunityIcons name="phone-outline" size={18} color={cargoTheme.colors.primaryDark} />
                    <Text style={styles.phoneCardLabel}>Driver phone</Text>
                  </View>
                  <View style={styles.phoneCardTrailing}>
                    <Text style={[styles.phoneCardValue, !hasDriverPhone && styles.phoneCardValueMuted]}>
                      {driverPhone || 'Phone pending'}
                    </Text>
                    {hasDriverPhone ? (
                      <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" />
                    ) : null}
                  </View>
                </TouchableOpacity>

                <View style={styles.driverActions}>
                  <PrimaryButton
                    label={hasDriverPhone ? 'Call driver' : 'Phone pending'}
                    variant="secondary"
                    icon="phone-outline"
                    style={[styles.actionButton, !hasDriverPhone && styles.actionButtonDisabled]}
                    onPress={() => {
                      void handleCallDriver();
                    }}
                  />
                  <PrimaryButton
                    label="Share trip"
                    variant="secondary"
                    icon="share-variant-outline"
                    style={styles.actionButton}
                    onPress={() => {
                      void handleShareTrip();
                    }}
                  />
                </View>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Trip details</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Order ID</Text>
                  <Text style={styles.summaryValue}>{order.orderNumber}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Route</Text>
                  <Text style={styles.summaryValue}>{order.routeLabel || `${order.pickupLabel} to ${order.dropoffLabel}`}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Fare</Text>
                  <Text style={styles.summaryValue}>{order.totalLabel}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Created</Text>
                  <Text style={styles.summaryValue}>{formatDeliveryDateTime(order.createdAt)}</Text>
                </View>
              </View>

              {order.status === 'cancelled' ? (
                <View style={styles.cancelInfoCard}>
                  <Text style={styles.cancelInfoTitle}>Cancellation details</Text>
                  <Text style={styles.cancelInfoText}>
                    Cancelled by {getCancellationActorLabel(order.cancelledBy)}
                    {order.cancelledAt ? ` • ${formatDeliveryDateTime(order.cancelledAt)}` : ''}
                  </Text>
                  {cancellationReason ? <Text style={styles.cancelInfoReason}>{cancellationReason}</Text> : null}
                </View>
              ) : null}

              {canCancelOrder ? (
                <PrimaryButton
                  label="Cancel order"
                  variant="dark"
                  icon="close-circle-outline"
                  style={styles.cancelToggleButton}
                  onPress={() => setShowCancelPanel(true)}
                />
              ) : null}

              <View style={styles.progressCard}>
                <Text style={styles.progressTitle}>Order progress</Text>
                {progressSteps.map((step, index) => (
                  <View key={step.title} style={styles.progressRow}>
                    <View style={styles.progressRail}>
                      <View style={[styles.progressDot, step.active && styles.progressDotActive]} />
                      {index !== progressSteps.length - 1 ? <View style={styles.progressLine} /> : null}
                    </View>
                    <View style={styles.progressCopy}>
                      <Text style={[styles.progressStepTitle, step.active && styles.progressStepTitleActive]}>{step.title}</Text>
                      <Text style={styles.progressStepNote}>{step.note}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>

        <BottomNav activeTab="track" />
      </View>
      <Modal animationType="slide" transparent visible={showCancelPanel} onRequestClose={() => setShowCancelPanel(false)}>
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              if (!cancelSubmitting) {
                setShowCancelPanel(false);
              }
            }}
          />
          <View style={styles.cancelCard}>
            <View style={styles.cancelHeader}>
              <Text style={styles.cancelTitle}>Cancel this order</Text>
              <TouchableOpacity
                disabled={cancelSubmitting}
                onPress={() => {
                  setShowCancelPanel(false);
                  setCancelReason('');
                }}>
                <MaterialCommunityIcons name="close" size={22} color={cargoTheme.colors.subtext} />
              </TouchableOpacity>
            </View>
            <Text style={styles.cancelText}>Choose the reason that best explains why you want to cancel.</Text>
            <View style={styles.reasonList}>
              {cancellationReasons.map((reason) => {
                const isSelected = cancelReason === reason;

                return (
                  <TouchableOpacity
                    key={reason}
                    activeOpacity={0.88}
                    style={[styles.reasonOption, isSelected && styles.reasonOptionSelected]}
                    onPress={() => setCancelReason(reason)}>
                    <View style={[styles.reasonRadio, isSelected && styles.reasonRadioSelected]}>
                      {isSelected ? <View style={styles.reasonRadioDot} /> : null}
                    </View>
                    <Text style={[styles.reasonLabel, isSelected && styles.reasonLabelSelected]}>{reason}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.cancelActionRow}>
              <PrimaryButton
                label="Keep order"
                variant="secondary"
                style={styles.cancelSecondaryAction}
                onPress={() => {
                  setShowCancelPanel(false);
                  setCancelReason('');
                }}
              />
              <PrimaryButton
                label={cancelSubmitting ? 'Cancelling...' : 'Confirm cancel'}
                variant="dark"
                icon="close-circle-outline"
                style={styles.cancelPrimaryAction}
                onPress={handleSubmitCancelOrder}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: cargoTheme.colors.canvas,
  },
  mapWrap: {
    height: height * 0.42,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
  },
  topBar: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chromeButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleChip: {
    backgroundColor: 'rgba(15,23,42,0.72)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  titleChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sheet: {
    flex: 1,
    marginTop: -24,
    backgroundColor: cargoTheme.colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  sheetContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
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
  statusCard: {
    backgroundColor: cargoTheme.colors.darkSurface,
    borderRadius: 28,
    padding: 18,
    marginBottom: 18,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginBottom: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#D7E1EA',
  },
  driverCard: {
    backgroundColor: cargoTheme.colors.surface,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
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
    marginRight: 8,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 4,
  },
  driverMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: cargoTheme.colors.subtext,
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  driverActions: {
    flexDirection: 'row',
    gap: 10,
  },
  phoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 14,
    gap: 10,
  },
  phoneCardMuted: {
    opacity: 0.72,
  },
  phoneCardLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneCardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: cargoTheme.colors.subtext,
  },
  phoneCardTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  phoneCardValue: {
    fontSize: 14,
    fontWeight: '800',
    color: cargoTheme.colors.text,
  },
  phoneCardValueMuted: {
    color: cargoTheme.colors.subtext,
  },
  actionButton: {
    flex: 1,
  },
  actionButtonDisabled: {
    opacity: 0.72,
  },
  cancelToggleButton: {
    marginBottom: 18,
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  cancelCard: {
    backgroundColor: '#FFF7ED',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 18,
    paddingBottom: 28,
  },
  cancelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cancelTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: cargoTheme.colors.text,
  },
  cancelText: {
    fontSize: 13,
    lineHeight: 19,
    color: cargoTheme.colors.subtext,
    marginBottom: 12,
  },
  reasonList: {
    gap: 10,
    marginBottom: 14,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  reasonOptionSelected: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  reasonRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonRadioSelected: {
    borderColor: '#DC2626',
  },
  reasonRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  reasonLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: cargoTheme.colors.text,
  },
  reasonLabelSelected: {
    color: '#991B1B',
    fontWeight: '700',
  },
  cancelActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelPrimaryAction: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  cancelSecondaryAction: {
    flex: 1,
  },
  cancelInfoCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 18,
    marginBottom: 18,
  },
  cancelInfoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#991B1B',
    marginBottom: 6,
  },
  cancelInfoText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#991B1B',
    marginBottom: 8,
  },
  cancelInfoReason: {
    fontSize: 13,
    lineHeight: 20,
    color: cargoTheme.colors.text,
  },
  summaryCard: {
    backgroundColor: cargoTheme.colors.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    marginBottom: 18,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  summaryLabel: {
    fontSize: 13,
    color: cargoTheme.colors.subtext,
  },
  summaryValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: cargoTheme.colors.text,
    textAlign: 'right',
  },
  progressCard: {
    backgroundColor: cargoTheme.colors.surface,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    borderRadius: 24,
    padding: 18,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 14,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 12,
  },
  progressRail: {
    width: 18,
    alignItems: 'center',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#CBD5E1',
    marginTop: 4,
  },
  progressDotActive: {
    backgroundColor: cargoTheme.colors.primary,
  },
  progressLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E2E8F0',
    marginTop: 4,
    marginBottom: 4,
  },
  progressCopy: {
    flex: 1,
    paddingBottom: 16,
  },
  progressStepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: cargoTheme.colors.subtext,
    marginBottom: 4,
  },
  progressStepTitleActive: {
    color: cargoTheme.colors.text,
  },
  progressStepNote: {
    fontSize: 12,
    lineHeight: 18,
    color: '#94A3B8',
  },
});
