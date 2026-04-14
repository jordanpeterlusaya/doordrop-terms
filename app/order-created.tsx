import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CargoHeader, CargoScreen, PrimaryButton, SummaryRow } from '@/components/cargo-ui';
import { cargoTheme, cargoVehicles, type FlowType, type ParcelScope } from '@/constants/cargo-theme';

export default function OrderCreatedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ flow?: string; scope?: string; vehicle?: string }>();

  const flow: FlowType = params.flow === 'cargo' ? 'cargo' : 'parcel';
  const scope: ParcelScope = params.scope === 'outside' ? 'outside' : 'city';
  const vehicle = cargoVehicles.find((item) => item.key === params.vehicle) ?? cargoVehicles[1];

  return (
    <CargoScreen contentContainerStyle={styles.content}>
      <CargoHeader title="Order created" subtitle="Your booking is confirmed and a driver has already been assigned." onLeftPress={() => router.replace('/home')} leftAction="close" />

      <View style={styles.successCard}>
        <View style={styles.successIconWrap}>
          <MaterialCommunityIcons name="check" size={34} color={cargoTheme.colors.primaryDark} />
        </View>
        <Text style={styles.successTitle}>Driver matched successfully</Text>
        <Text style={styles.successText}>
          {flow === 'cargo' ? vehicle.title : scope === 'city' ? 'In-city parcel rider' : 'Long-distance parcel driver'} is on the way to pickup.
        </Text>
      </View>

      <View style={styles.driverCard}>
        <View style={styles.driverTop}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverAvatarText}>JK</Text>
          </View>
          <View style={styles.driverCopy}>
            <Text style={styles.driverName}>Juma Kassim</Text>
            <Text style={styles.driverMeta}>
              {flow === 'cargo' ? vehicle.title : 'Parcel rider'} • 4.9 rating • 8 min away
            </Text>
          </View>
        </View>

        <SummaryRow label="Order ID" value="DD-20518" />
        <SummaryRow label="Vehicle" value={flow === 'cargo' ? vehicle.title : 'Motorbike courier'} />
        <SummaryRow label="Contact" value="+255 754 222 333" />
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>What happens next</Text>
        <Text style={styles.tipText}>1. Driver navigates to your pickup point.</Text>
        <Text style={styles.tipText}>2. Pickup is confirmed with trip code and recipient details.</Text>
        <Text style={styles.tipText}>3. You follow the live route until delivery is complete.</Text>
      </View>

      <PrimaryButton
        label="Track this order"
        icon="map-marker-path"
        onPress={() => router.replace({ pathname: '/track-order', params: { flow } })}
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
