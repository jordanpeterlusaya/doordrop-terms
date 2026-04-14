import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { BottomNav } from '@/components/cargo-ui';
import { cargoTheme } from '@/constants/cargo-theme';

const { height } = Dimensions.get('window');
const SHEET_EXPANDED_TOP = height * 0.22;
const SHEET_DEFAULT_TOP = height * 0.47;
const SHEET_COLLAPSED_TOP = height * 0.68;

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
    title: 'Book cargo',
    image: require('@/assets/images/home-book-cargo.png'),
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
    title: 'Book cargo',
    subtitle: 'Plan a cargo vehicle around your preferred time.',
    route: '/book-cargo',
  },
];

export default function HomePage() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [showHeroCard, setShowHeroCard] = useState(true);
  const mapRef = React.useRef<MapView>(null);
  const sheetTop = React.useRef(new Animated.Value(SHEET_DEFAULT_TOP)).current;
  const sheetTopRef = React.useRef(SHEET_DEFAULT_TOP);
  const sheetStartTop = React.useRef(SHEET_DEFAULT_TOP);
  const snapPoints = React.useMemo(
    () => [SHEET_EXPANDED_TOP, SHEET_DEFAULT_TOP, SHEET_COLLAPSED_TOP],
    []
  );

  const defaultRegion = {
    latitude: -6.7924,
    longitude: 39.2083,
    latitudeDelta: 0.0322,
    longitudeDelta: 0.0221,
  };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);

      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            latitudeDelta: 0.0222,
            longitudeDelta: 0.0151,
          },
          900
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (!isFocused) {
      setShowHeroCard(false);
      return;
    }

    setShowHeroCard(true);
    const timer = setTimeout(() => {
      setShowHeroCard(false);
    }, 7000);

    return () => clearTimeout(timer);
  }, [isFocused]);

  useEffect(() => {
    const listenerId = sheetTop.addListener(({ value }) => {
      sheetTopRef.current = value;
    });

    return () => {
      sheetTop.removeListener(listenerId);
    };
  }, [sheetTop]);

  const userRegion = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0222,
        longitudeDelta: 0.0151,
      }
    : defaultRegion;

  const handleScheduleSelect = (route: '/send-parcel' | '/book-cargo') => {
    setScheduleOpen(false);
    router.push(route);
  };

  const animateSheetTo = React.useCallback(
    (toValue: number) => {
      Animated.spring(sheetTop, {
        toValue,
        useNativeDriver: false,
        tension: 70,
        friction: 14,
      }).start();
    },
    [sheetTop]
  );

  const clampSheetTop = React.useCallback((value: number) => {
    return Math.min(Math.max(value, SHEET_EXPANDED_TOP), SHEET_COLLAPSED_TOP);
  }, []);

  const getNearestSnapPoint = React.useCallback(
    (value: number) => {
      return snapPoints.reduce((closest, point) => {
        return Math.abs(point - value) < Math.abs(closest - value) ? point : closest;
      }, snapPoints[0]);
    },
    [snapPoints]
  );

  const sheetPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 6,
        onPanResponderGrant: () => {
          sheetTop.stopAnimation((value) => {
            sheetStartTop.current = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const nextTop = clampSheetTop(sheetStartTop.current + gestureState.dy);
          sheetTop.setValue(nextTop);
        },
        onPanResponderRelease: (_, gestureState) => {
          const nextTop = clampSheetTop(sheetStartTop.current + gestureState.dy);
          animateSheetTo(getNearestSnapPoint(nextTop));
        },
        onPanResponderTerminate: () => {
          animateSheetTo(getNearestSnapPoint(sheetTopRef.current));
        },
      }),
    [animateSheetTo, clampSheetTop, getNearestSnapPoint, sheetTop]
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={userRegion}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          loadingEnabled>
          {location ? (
            <Marker
              coordinate={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }}
              title="Pickup area"
              description="Your current location"
            />
          ) : null}
        </MapView>

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

          {showHeroCard ? (
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
          ) : null}
        </View>
      </View>

      <Animated.View style={[styles.sheet, { top: sheetTop }]}>
        <View style={styles.dragHandleArea} {...sheetPanResponder.panHandlers}>
          <View style={styles.dragHandle} />
        </View>

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}>
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
                  <Image source={card.image} style={styles.serviceImage} contentFit="cover" transition={150} />
                </View>
                <View style={styles.serviceCopy}>
                  <Text style={styles.serviceTitle}>{card.title}</Text>
                  <Text style={styles.serviceLink}>Continue</Text>
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
      </Animated.View>

      <Modal
        animationType="slide"
        transparent
        visible={scheduleOpen}
        onRequestClose={() => setScheduleOpen(false)}>
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
  },
  map: {
    ...StyleSheet.absoluteFillObject,
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
    marginBottom: 12,
  },
  serviceLink: {
    fontSize: 13,
    fontWeight: '800',
    color: cargoTheme.colors.primaryDark,
  },
  scheduleButton: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E7EEF5',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  scheduleLeading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scheduleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: cargoTheme.colors.primarySoft,
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
    fontSize: 13,
    lineHeight: 19,
    color: cargoTheme.colors.subtext,
  },
  scheduleActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  scheduleActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: cargoTheme.colors.primaryDark,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
  },
  sheetModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sheetHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D7DEE7',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetModalTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 6,
  },
  sheetModalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: cargoTheme.colors.subtext,
    marginBottom: 18,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E8EEF4',
    marginBottom: 12,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  sheetCloseText: {
    fontSize: 15,
    fontWeight: '700',
    color: cargoTheme.colors.primaryDark,
  },
});
