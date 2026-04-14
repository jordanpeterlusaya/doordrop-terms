import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { BottomNav, PrimaryButton } from '@/components/cargo-ui';
import { cargoTheme, trackingSteps, type FlowType } from '@/constants/cargo-theme';

const { height } = Dimensions.get('window');

const routePoints = [
  { latitude: -6.7759, longitude: 39.2401 },
  { latitude: -6.7851, longitude: 39.2565 },
  { latitude: -6.7923, longitude: 39.2711 },
];

export default function TrackOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ flow?: string }>();
  const flow: FlowType = params.flow === 'parcel' ? 'parcel' : 'cargo';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.mapWrap}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: -6.7844,
            longitude: 39.2556,
            latitudeDelta: 0.04,
            longitudeDelta: 0.03,
          }}>
          <Marker coordinate={routePoints[0]} title="Pickup" description="Mlimani City" />
          <Marker coordinate={routePoints[2]} title="Destination" description="Kariakoo" />
          <Marker coordinate={routePoints[1]} title="Driver" description="Driver Juma" pinColor={cargoTheme.colors.primary} />
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
          <View style={styles.statusCard}>
            <View style={styles.statusBadge}>
              <MaterialCommunityIcons name="clock-outline" size={16} color="#FFFFFF" />
              <Text style={styles.statusBadgeText}>ETA 8 min</Text>
            </View>
            <Text style={styles.statusTitle}>
              {flow === 'cargo' ? 'Cargo vehicle approaching pickup' : 'Parcel rider is heading to pickup'}
            </Text>
            <Text style={styles.statusText}>
              Driver Juma Kassim accepted the request and is navigating toward your loading point now.
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
                  {flow === 'cargo' ? 'Cargo van • T 542 DDX' : 'Motorbike courier • MC 228 TZ'}
                </Text>
              </View>
              <View style={styles.ratingWrap}>
                <MaterialCommunityIcons name="star" size={14} color="#F59E0B" />
                <Text style={styles.ratingText}>4.9</Text>
              </View>
            </View>

            <View style={styles.driverActions}>
              <PrimaryButton label="Call driver" variant="secondary" icon="phone-outline" style={styles.actionButton} />
              <PrimaryButton label="Share trip" variant="secondary" icon="share-variant-outline" style={styles.actionButton} />
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Trip details</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Order ID</Text>
              <Text style={styles.summaryValue}>DD-20518</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Route</Text>
              <Text style={styles.summaryValue}>Mlimani City to Kariakoo</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Fare</Text>
              <Text style={styles.summaryValue}>{flow === 'cargo' ? 'TZS 33,000' : 'TZS 7,500'}</Text>
            </View>
          </View>

          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Order progress</Text>
            {trackingSteps.map((step, index) => {
              const isActive = index < 2;
              return (
                <View key={step.title} style={styles.progressRow}>
                  <View style={styles.progressRail}>
                    <View style={[styles.progressDot, isActive && styles.progressDotActive]} />
                    {index !== trackingSteps.length - 1 ? <View style={styles.progressLine} /> : null}
                  </View>
                  <View style={styles.progressCopy}>
                    <Text style={[styles.progressStepTitle, isActive && styles.progressStepTitleActive]}>{step.title}</Text>
                    <Text style={styles.progressStepNote}>{step.note}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <BottomNav activeTab="track" />
      </View>
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
  actionButton: {
    flex: 1,
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
  },
  summaryLabel: {
    fontSize: 13,
    color: cargoTheme.colors.subtext,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '800',
    color: cargoTheme.colors.text,
  },
  progressCard: {
    backgroundColor: cargoTheme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EDF2F7',
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
    alignItems: 'flex-start',
  },
  progressRail: {
    width: 20,
    alignItems: 'center',
    marginRight: 10,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#CBD5E1',
    marginTop: 3,
  },
  progressDotActive: {
    backgroundColor: cargoTheme.colors.primary,
  },
  progressLine: {
    width: 2,
    flex: 1,
    minHeight: 38,
    backgroundColor: '#E2E8F0',
    marginTop: 4,
  },
  progressCopy: {
    flex: 1,
    paddingBottom: 16,
  },
  progressStepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 4,
  },
  progressStepTitleActive: {
    color: cargoTheme.colors.primaryDark,
  },
  progressStepNote: {
    fontSize: 12,
    lineHeight: 18,
    color: cargoTheme.colors.subtext,
  },
});
