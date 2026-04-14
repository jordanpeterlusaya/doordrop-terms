import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CargoHeader, CargoScreen, PrimaryButton, SummaryRow } from '@/components/cargo-ui';
import {
  cargoTheme,
  cargoVehicles,
  parcelPackages,
  type FlowType,
  type ParcelScope,
} from '@/constants/cargo-theme';

export default function OrderReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    flow?: string;
    scope?: string;
    parcelType?: string;
    parcelLabel?: string;
    vehicle?: string;
    timing?: string;
    pickup?: string;
    dropoff?: string;
    recipientName?: string;
    recipientPhone?: string;
    scheduleDate?: string;
    scheduleTime?: string;
  }>();

  const flow: FlowType = params.flow === 'cargo' ? 'cargo' : 'parcel';
  const scope: ParcelScope = params.scope === 'outside' ? 'outside' : 'city';
  const parcelType = parcelPackages.find((item) => item.key === params.parcelType) ?? parcelPackages[0];
  const vehicle = cargoVehicles.find((item) => item.key === params.vehicle) ?? cargoVehicles[1];
  const timing =
    params.timing === 'later'
      ? `Scheduled${params.scheduleDate || params.scheduleTime ? ` • ${[params.scheduleDate, params.scheduleTime].filter(Boolean).join(' at ')}` : ''}`
      : 'Dispatch now';
  const parseTzs = (value: string) => Number(value.replace(/[^\d]/g, '')) || 0;
  const formatTzs = (amount: number) => `TZS ${amount.toLocaleString('en-US')}`;

  const serviceLabel =
    flow === 'cargo' ? vehicle.title : scope === 'city' ? 'In-city parcel delivery' : 'Outside-city parcel delivery';
  const estimatedFare =
    flow === 'cargo' ? vehicle.price : scope === 'city' ? 'TZS 6,500' : 'TZS 18,500';
  const eta = flow === 'cargo' ? vehicle.eta : scope === 'city' ? '15-30 min' : '3-5 hrs';
  const estimatedTotal =
    flow === 'cargo' ? formatTzs(parseTzs(vehicle.price) + 1000) : scope === 'city' ? 'TZS 7,500' : 'TZS 19,500';
  const pickupValue = flow === 'cargo' ? params.pickup ?? 'Mlimani City loading bay' : params.pickup ?? 'Posta Mpya, Azikiwe Street';
  const dropoffValue =
    flow === 'cargo'
      ? params.dropoff ?? 'Kariakoo wholesale district'
      : params.dropoff ?? (scope === 'city' ? 'Masaki, Haile Selassie Road' : 'Morogoro town center');
  const recipientValue =
    params.recipientName || params.recipientPhone
      ? [params.recipientName, params.recipientPhone].filter(Boolean).join(' • ')
      : 'Amina Salim • +255 744 123 222';
  const parcelTypeLabel = params.parcelLabel ?? parcelType.title;

  return (
    <CargoScreen
      contentContainerStyle={styles.content}
      footer={
        <View style={styles.footer}>
          <PrimaryButton
            label="Create order"
            icon="check-circle-outline"
            onPress={() =>
              router.push({
                pathname: '/order-created',
                params: {
                  flow,
                  scope,
                  vehicle: vehicle.key,
                },
              })
            }
          />
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
          Pickup from central Dar es Salaam with verified driver assignment and live route visibility after booking.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trip summary</Text>
        <SummaryRow label="Pickup" value={pickupValue} />
        <SummaryRow label="Drop-off" value={dropoffValue} />
        <SummaryRow label="Timing" value={timing} />
        <SummaryRow label="Estimated ETA" value={eta} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Service details</Text>
        <SummaryRow label="Service" value={serviceLabel} />
        {flow === 'cargo' ? (
          <SummaryRow label="Vehicle capacity" value={vehicle.capacity} />
        ) : (
          <SummaryRow label="Parcel type" value={parcelTypeLabel} />
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
          Driver details, trip code and live tracking will appear immediately after order creation.
        </Text>
      </View>
    </CargoScreen>
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
    fontWeight: '700',
    color: '#FFFFFF',
  },
  highlightTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
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
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 14,
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
