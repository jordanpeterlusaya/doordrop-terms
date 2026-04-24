import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { BottomNav } from '@/components/cargo-ui';
import { cargoTheme } from '@/constants/cargo-theme';

const { height } = Dimensions.get('window');
const SHEET_DEFAULT_TOP = height * 0.47;

const serviceCards: {
  title: string;
  image: number;
  route: '/send-parcel' | '/book-cargo';
}[] = [
  {
    title: 'Send parcel',
    image: require('@/assets/images/home-send-parcel.png'),
    route: '/send-parcel',
  },
  {
    title: 'Cargo Delivery',
    image: require('@/assets/images/vehicle-light-truck.png'),
    route: '/book-cargo',
  },
];

const scheduleOptions: {
  title: string;
  subtitle: string;
  route: '/send-parcel' | '/book-cargo';
}[] = [
  {
    title: 'Send parcel',
    subtitle: 'Schedule a parcel pickup or drop-off for later.',
    route: '/send-parcel',
  },
  {
    title: 'Cargo Delivery',
    subtitle: 'Plan transport for your goods at your preferred time.',
    route: '/book-cargo',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const handleScheduleSelect = (route: '/send-parcel' | '/book-cargo') => {
    setScheduleOpen(false);
    router.push(route);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.mapWrap}>
        <View style={styles.fakeMapBase} />
        <View style={styles.fakeRoadPrimary} />
        <View style={styles.fakeRoadSecondary} />
        <View style={styles.fakeRoadTertiary} />
        <View style={styles.fakePinWrap}>
          <View style={styles.fakePinPickup}>
            <MaterialCommunityIcons name="map-marker" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.fakePinDropoff}>
            <MaterialCommunityIcons name="truck-fast-outline" size={16} color="#FFFFFF" />
          </View>
        </View>
        <View style={styles.mapShade} />

        <View style={styles.overlay}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.chromeButton} onPress={() => router.push('/menu')}>
              <MaterialCommunityIcons name="menu" size={22} color={cargoTheme.colors.text} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.locationChip} activeOpacity={0.88}>
              <View style={styles.locationDot} />
              <Text style={styles.locationText}>Dar es Salaam, TZ</Text>
              <MaterialCommunityIcons name="chevron-down" size={18} color={cargoTheme.colors.subtext} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.chromeButton} activeOpacity={0.88}>
              <MaterialCommunityIcons name="map-outline" size={22} color={cargoTheme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>DoorDrop Cargo</Text>
            <Text style={styles.heroTitle}>Book delivery the same way you’d book a ride.</Text>
            <Text style={styles.heroSubtitle}>
              Parcel or cargo, choose the service you need and move from pickup to drop-off in a few guided steps.
            </Text>

            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>15 min</Text>
                <Text style={styles.metricLabel}>Quick pickup</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>4.9</Text>
                <Text style={styles.metricLabel}>Trusted rating</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>24/7</Text>
                <Text style={styles.metricLabel}>Support</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.sheet, { top: SHEET_DEFAULT_TOP }]}>
        <View style={styles.dragHandleArea}>
          <View style={styles.dragHandle} />
        </View>

        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <View style={styles.servicePrompt}>
            <Text style={styles.servicePromptTitle}>What do you want to do today?</Text>
            <Text style={styles.servicePromptText}>Choose a service to get started with delivery or scheduling.</Text>
          </View>

          <View style={styles.serviceGrid}>
            {serviceCards.map((card) => (
              <TouchableOpacity
                key={card.title}
                style={styles.serviceCard}
                activeOpacity={0.9}
                onPress={() => router.push(card.route)}>
                <View style={styles.serviceImageWrap}>
                  <Image source={card.image} style={styles.serviceImage} resizeMode="cover" />
                </View>
                <View style={styles.serviceCopy}>
                  <Text style={styles.serviceTitle}>{card.title}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.scheduleButton} activeOpacity={0.9} onPress={() => setScheduleOpen(true)}>
            <View style={styles.scheduleLeading}>
              <View style={styles.scheduleIconWrap}>
                <MaterialCommunityIcons name="calendar-clock-outline" size={20} color={cargoTheme.colors.primaryDark} />
              </View>
              <View style={styles.scheduleCopy}>
                <Text style={styles.scheduleTitle}>Schedule delivery</Text>
                <Text style={styles.scheduleSubtitle}>Choose parcel or cargo and set it for later.</Text>
              </View>
            </View>

            <View style={styles.scheduleActionChip}>
              <Text style={styles.scheduleActionText}>Later</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={cargoTheme.colors.primaryDark} />
            </View>
          </TouchableOpacity>
        </ScrollView>

        <BottomNav activeTab="home" />
      </View>

      <Modal animationType="slide" transparent visible={scheduleOpen} onRequestClose={() => setScheduleOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setScheduleOpen(false)} />

          <View style={styles.sheetModal}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetModalTitle}>Schedule delivery</Text>
            <Text style={styles.sheetModalSubtitle}>Choose the service you want to plan for later.</Text>

            {scheduleOptions.map((option) => (
              <TouchableOpacity
                key={option.title}
                style={styles.sheetOption}
                activeOpacity={0.9}
                onPress={() => handleScheduleSelect(option.route)}>
                <View style={styles.sheetOptionCopy}>
                  <Text style={styles.sheetOptionTitle}>{option.title}</Text>
                  <Text style={styles.sheetOptionSubtitle}>{option.subtitle}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.sheetCloseButton} activeOpacity={0.88} onPress={() => setScheduleOpen(false)}>
              <Text style={styles.sheetCloseText}>Cancel</Text>
            </TouchableOpacity>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#D8E7E0',
  },
  fakeMapBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#CFE2D8',
  },
  fakeRoadPrimary: {
    position: 'absolute',
    top: 120,
    left: -40,
    right: -20,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.35)',
    transform: [{ rotate: '-18deg' }],
  },
  fakeRoadSecondary: {
    position: 'absolute',
    top: 220,
    left: 40,
    right: -80,
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
    transform: [{ rotate: '16deg' }],
  },
  fakeRoadTertiary: {
    position: 'absolute',
    top: 320,
    left: -20,
    width: 220,
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
    transform: [{ rotate: '36deg' }],
  },
  fakePinWrap: {
    position: 'absolute',
    top: 140,
    right: 54,
    left: 54,
    bottom: 0,
  },
  fakePinPickup: {
    position: 'absolute',
    top: 24,
    left: 22,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fakePinDropoff: {
    position: 'absolute',
    top: 98,
    right: 36,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 52,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  chromeButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationChip: {
    flex: 1,
    minHeight: 46,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 23,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: cargoTheme.colors.primary,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: cargoTheme.colors.text,
  },
  heroCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 28,
    padding: 20,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: '#A7F3D0',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: '#D9E3ED',
    marginBottom: 18,
  },
  metricRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    paddingVertical: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D9E3ED',
  },
  metricDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: cargoTheme.colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  dragHandleArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: cargoTheme.colors.surface,
  },
  dragHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D7DEE7',
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 28,
  },
  servicePrompt: {
    marginBottom: 18,
  },
  servicePromptTitle: {
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  servicePromptText: {
    fontSize: 14,
    lineHeight: 21,
    color: cargoTheme.colors.subtext,
  },
  serviceGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  serviceCard: {
    flex: 1,
    backgroundColor: cargoTheme.colors.card,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8EEF4',
  },
  serviceImageWrap: {
    height: 132,
    backgroundColor: '#F6F8FB',
  },
  serviceImage: {
    width: '100%',
    height: '100%',
  },
  serviceCopy: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: cargoTheme.colors.text,
  },
  scheduleButton: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  scheduleLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  scheduleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleCopy: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 4,
  },
  scheduleSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: cargoTheme.colors.subtext,
  },
  scheduleActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
  },
  scheduleActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: cargoTheme.colors.primaryDark,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.38)',
  },
  sheetModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 26,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D7DEE7',
    marginBottom: 16,
  },
  sheetModalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 6,
  },
  sheetModalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: cargoTheme.colors.subtext,
    marginBottom: 16,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  sheetOptionCopy: {
    flex: 1,
  },
  sheetOptionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 4,
  },
  sheetOptionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: cargoTheme.colors.subtext,
  },
  sheetCloseButton: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cargoTheme.colors.darkSurface,
  },
  sheetCloseText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
