import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FirebaseError } from 'firebase/app';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AuthSessionBoundary } from '@/components/auth/session-boundary';
import { CargoHeader, CargoScreen, PrimaryButton, SummaryRow } from '@/components/cargo-ui';
import { cargoTheme, cargoVehicles, type FlowType, type ParcelScope } from '@/constants/cargo-theme';
import { typography } from '@/constants/typography';
import { getFirebaseDataErrorMessage } from '@/lib/auth-errors';
import { createDeliveryOrder } from '@/lib/delivery-data';
import { useAuthSession } from '@/providers/auth-provider';

function parseCoordinate(value?: string | string[]) {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized?.trim()) {
    return undefined;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function OrderReviewScreenContent() {
  const router = useRouter();
  const { authError, profile, user } = useAuthSession();
  const params = useLocalSearchParams<{
    flow?: string;
    scope?: string;
    parcelType?: string;
    parcelLabel?: string;
    price?: string;
    eta?: string;
    pricingRoute?: string;
    vehicle?: string;
    timing?: string;
    pickup?: string;
    pickupLat?: string;
    pickupLng?: string;
    dropoff?: string;
    dropoffLat?: string;
    dropoffLng?: string;
    recipientName?: string;
    recipientPhone?: string;
    parcelWeightKg?: string;
    scheduleDate?: string;
    scheduleTime?: string;
    distance?: string;
    duration?: string;
  }>();
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [error, setError] = useState('');

  const flow: FlowType = params.flow === 'cargo' ? 'cargo' : 'parcel';
  const scope: ParcelScope = params.scope === 'outside' ? 'outside' : 'city';
  const vehicle = cargoVehicles.find((item) => item.key === params.vehicle) ?? cargoVehicles[1];
  const parseTzs = (value: string) => Number(value.replace(/[^\d]/g, '')) || 0;
  const formatTzs = (amount: number) => `TZS ${amount.toLocaleString('en-US')}`;

  const timing =
    params.timing === 'later'
      ? `Scheduled${params.scheduleDate || params.scheduleTime ? ` • ${[params.scheduleDate, params.scheduleTime].filter(Boolean).join(' at ')}` : ''}`
      : 'Dispatch now';

  const serviceLabel =
    flow === 'cargo' ? vehicle.title : scope === 'city' ? 'In-city parcel delivery' : 'Outside-city parcel delivery';
  const estimatedFare =
    flow === 'cargo' ? params.price ?? vehicle.price : params.price ?? (scope === 'city' ? 'TZS 6,500' : 'TZS 18,500');
  const eta = flow === 'cargo' ? params.duration ?? vehicle.eta : params.eta ?? (scope === 'city' ? '15-30 min' : '3-5 hrs');
  const estimatedTotal =
    flow === 'cargo'
      ? formatTzs(parseTzs(params.price ?? vehicle.price) + 1000)
      : params.price?.includes('-')
        ? params.price
        : formatTzs(parseTzs(params.price ?? (scope === 'city' ? 'TZS 6,500' : 'TZS 18,500')) + 1000);
  const pickupValue = params.pickup ?? (flow === 'cargo' ? 'Mlimani City loading bay' : 'Posta Mpya, Azikiwe Street');
  const dropoffValue =
    params.dropoff ??
    (flow === 'cargo' ? 'Kariakoo wholesale district' : scope === 'city' ? 'Masaki, Haile Selassie Road' : 'Morogoro town center');
  const parcelTypeLabel = params.parcelLabel ?? 'Parcel order';
  const parcelWeightLabel = params.parcelWeightKg?.trim() ? `${params.parcelWeightKg.trim()} kg` : '';
  const pricingRoute = params.pricingRoute;
  const pickupLatitude = useMemo(() => parseCoordinate(params.pickupLat), [params.pickupLat]);
  const pickupLongitude = useMemo(() => parseCoordinate(params.pickupLng), [params.pickupLng]);
  const dropoffLatitude = useMemo(() => parseCoordinate(params.dropoffLat), [params.dropoffLat]);
  const dropoffLongitude = useMemo(() => parseCoordinate(params.dropoffLng), [params.dropoffLng]);
  const customerName = profile?.fullName?.trim() || user?.displayName?.trim() || 'DoorDrop Customer';
  const customerPhone = profile?.phoneNumber?.trim() || '';
  const customerEmail = user?.email?.trim().toLowerCase() || '';
  const recipientValue =
    params.recipientName || params.recipientPhone
      ? [params.recipientName, params.recipientPhone].filter(Boolean).join(' • ')
      : 'Recipient details will be confirmed by dispatch';

  const handleCreateOrder = async () => {
    if (!user || creatingOrder) {
      return;
    }

    setCreatingOrder(true);
    setError('');

    try {
      const order = await createDeliveryOrder({
        userId: user.uid,
        customerName,
        customerEmail,
        customerPhone,
        flow,
        serviceLabel,
        pickupLabel: pickupValue,
        dropoffLabel: dropoffValue,
        pickupLatitude,
        pickupLongitude,
        dropoffLatitude,
        dropoffLongitude,
        etaLabel: eta,
        fareLabel: estimatedFare,
        totalLabel: estimatedTotal,
        routeLabel: pricingRoute ?? `${pickupValue} to ${dropoffValue}`,
        timingMode: params.timing === 'later' ? 'later' : 'now',
        scheduleDate: params.scheduleDate,
        scheduleTime: params.scheduleTime,
        scheduleLabel: timing,
        recipientName: params.recipientName?.trim() || 'Recipient not provided',
        recipientPhone: params.recipientPhone?.trim() || 'Not provided',
        parcelScope: flow === 'parcel' ? scope : undefined,
        parcelTypeKey: flow === 'parcel' ? params.parcelType : undefined,
        parcelTypeLabel: flow === 'parcel' ? parcelTypeLabel : undefined,
        cargoVehicleKey: flow === 'cargo' ? vehicle.key : undefined,
        cargoVehicleLabel: flow === 'cargo' ? vehicle.title : undefined,
        cargoCapacityLabel: flow === 'cargo' ? vehicle.capacity : undefined,
        distanceLabel: flow === 'cargo' ? params.distance : undefined,
        durationLabel: flow === 'cargo' ? params.duration : undefined,
      });

      router.replace({
        pathname: '/order-created',
        params: {
          orderId: order.id,
        },
      });
    } catch (saveError) {
      const message =
        saveError instanceof FirebaseError
          ? getFirebaseDataErrorMessage(saveError.code, 'We could not save this order yet. Please try again.')
          : saveError instanceof Error
            ? saveError.message
            : 'We could not save this order yet. Please try again.';
      setError(message);
    } finally {
      setCreatingOrder(false);
    }
  };

  return (
    <CargoScreen
      contentContainerStyle={styles.content}
      footer={
        <View style={styles.footer}>
          {user ? (
            <PrimaryButton
              label={creatingOrder ? 'Creating order...' : 'Create order'}
              icon="check-circle-outline"
              onPress={handleCreateOrder}
              style={creatingOrder ? styles.buttonDisabled : undefined}
            />
          ) : (
            <View style={styles.authFooterActions}>
              <PrimaryButton
                label="Login to complete"
                onPress={() => router.push({ pathname: '/login', params: { returnTo: '/order-review' } })}
              />
              <PrimaryButton
                label="Register"
                variant="secondary"
                onPress={() => router.push({ pathname: '/register', params: { returnTo: '/order-review' } })}
              />
            </View>
          )}
          {creatingOrder ? <ActivityIndicator style={styles.loadingIndicator} color={cargoTheme.colors.primary} /> : null}
          {error || authError ? <Text style={styles.errorText}>{error || authError}</Text> : null}
        </View>
      }>
      <CargoHeader
        title="Review order"
        subtitle="Check pricing, route details and payment before you confirm the request."
        onLeftPress={() => router.back()}
        rightIcon="menu"
        onRightPress={() => router.push('/menu')}
      />

      <View style={styles.highlightCard}>
        <View style={styles.highlightBadge}>
          <MaterialCommunityIcons
            name={flow === 'cargo' ? 'truck-fast-outline' : 'package-variant-closed'}
            size={16}
            color="#FFFFFF"
          />
          <Text style={styles.highlightBadgeText}>{flow === 'cargo' ? 'Cargo request' : 'Parcel request'}</Text>
        </View>
        <Text style={styles.highlightTitle}>{serviceLabel}</Text>
        <Text style={styles.highlightText}>
          Once you create the order it is sent into DoorDrop dispatch, where our team can assign the best driver in real time.
        </Text>
      </View>

      {!user ? (
        <View style={styles.authGateCard}>
          <View style={styles.authGateBadge}>
            <MaterialCommunityIcons name="account-lock-outline" size={16} color="#FFFFFF" />
            <Text style={styles.authGateBadgeText}>Final step</Text>
          </View>
          <Text style={styles.authGateTitle}>Login to complete this order</Text>
          <Text style={styles.authGateText}>
            If you already have a DoorDrop account, login with your email and password. If you do not have one yet, register first using your full name, phone number, email and password.
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trip summary</Text>
        <SummaryRow label="Pickup" value={pickupValue} />
        <SummaryRow label="Drop-off" value={dropoffValue} />
        {flow === 'parcel' && pricingRoute ? <SummaryRow label="Pricing lane" value={pricingRoute} /> : null}
        {flow === 'cargo' && params.distance ? <SummaryRow label="Distance" value={params.distance} /> : null}
        <SummaryRow label="Timing" value={timing} />
        <SummaryRow label="Estimated ETA" value={eta} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Service details</Text>
        <SummaryRow label="Service" value={serviceLabel} />
        {flow === 'cargo' ? (
          <SummaryRow label="Vehicle capacity" value={vehicle.capacity} />
        ) : (
          <>
            <SummaryRow label="Parcel type" value={parcelTypeLabel} />
            {scope === 'outside' && parcelWeightLabel ? <SummaryRow label="Weight" value={parcelWeightLabel} /> : null}
          </>
        )}
        <SummaryRow label="Recipient" value={recipientValue} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payment</Text>
        <SummaryRow label="Method" value="Cash on delivery" />
        <SummaryRow label="Service fare" value={estimatedFare} />
        <SummaryRow label="Platform fee" value="TZS 1,000" />
        <SummaryRow label="Estimated total" value={estimatedTotal} emphasis />
      </View>

      <View style={styles.noticeCard}>
        <MaterialCommunityIcons name="shield-check-outline" size={20} color={cargoTheme.colors.primaryDark} />
        <Text style={styles.noticeText}>
          After the order is created, DoorDrop dispatch receives it instantly and can assign a driver without calling you back.
        </Text>
      </View>
    </CargoScreen>
  );
}

export default function OrderReviewScreen() {
  return (
    <AuthSessionBoundary>
      <OrderReviewScreenContent />
    </AuthSessionBoundary>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 20,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: cargoTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#EAF0F6',
  },
  buttonDisabled: {
    opacity: 0.74,
  },
  loadingIndicator: {
    marginTop: 10,
  },
  authFooterActions: {
    gap: 10,
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: typography.bold,
    color: '#DC2626',
    textAlign: 'center',
  },
  highlightCard: {
    backgroundColor: cargoTheme.colors.darkSurface,
    borderRadius: 28,
    padding: 18,
    marginBottom: 22,
  },
  highlightBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginBottom: 12,
  },
  highlightBadgeText: {
    fontSize: 12,
    fontFamily: typography.bold,
    color: '#FFFFFF',
  },
  highlightTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: typography.extrabold,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  highlightText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#D7E1EA',
  },
  card: {
    backgroundColor: cargoTheme.colors.surface,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: typography.extrabold,
    color: cargoTheme.colors.text,
    marginBottom: 14,
  },
  authGateCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },
  authGateBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginBottom: 12,
  },
  authGateBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: typography.bold,
  },
  authGateTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: typography.extrabold,
    marginBottom: 8,
  },
  authGateText: {
    color: '#D7E1EA',
    fontSize: 13,
    lineHeight: 20,
  },
  noticeCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    padding: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: cargoTheme.colors.primaryDark,
  },
});
