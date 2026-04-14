import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { PrimaryButton } from '@/components/cargo-ui';
import { cargoTheme, cargoVehicles } from '@/constants/cargo-theme';

type RoutePoint = {
  latitude: number;
  longitude: number;
};

type DestinationState = 'idle' | 'searching' | 'resolved' | 'preview' | 'error';

const { height: screenHeight } = Dimensions.get('window');
const vehicleSheetMaxHeight = Math.min(screenHeight * 0.52, 390);
const topOverlayBottomInset = vehicleSheetMaxHeight + 20;
const mapBottomEdgePadding = Math.min(vehicleSheetMaxHeight - 48, 330);

const defaultRegion = {
  latitude: -6.7924,
  longitude: 39.2083,
  latitudeDelta: 0.12,
  longitudeDelta: 0.08,
};

const vehicleImages: Record<string, number> = {
  kirikuu: require('@/assets/images/kirikuu.png'),
  pickup: require('@/assets/images/pickup.png'),
  toyo: require('@/assets/images/toyo.png'),
};

function formatPickupLabel(
  address: Location.LocationGeocodedAddress | null,
  point: RoutePoint | null
) {
  if (address) {
    const parts = [address.name, address.street, address.district, address.city].filter(Boolean);
    const unique = [...new Set(parts)];
    if (unique.length > 0) {
      return unique.slice(0, 2).join(', ');
    }
  }

  if (point) {
    return `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`;
  }

  return 'Detecting your current location...';
}

function buildPreviewDestination(origin: RoutePoint, seed: string): RoutePoint {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100000;
  }

  const latOffset = 0.012 + ((hash % 7) * 0.0025);
  const lngOffset = 0.014 + (((hash >> 3) % 7) * 0.0025);
  const latDirection = hash % 2 === 0 ? 1 : -1;
  const lngDirection = hash % 3 === 0 ? -1 : 1;

  return {
    latitude: origin.latitude + latOffset * latDirection,
    longitude: origin.longitude + lngOffset * lngDirection,
  };
}

export default function BookCargoScreen() {
  const router = useRouter();
  const mapRef = React.useRef<MapView>(null);
  const dropoffInputRef = React.useRef<TextInput>(null);
  const [pickupPoint, setPickupPoint] = useState<RoutePoint | null>(null);
  const [pickupLabel, setPickupLabel] = useState('Detecting your current location...');
  const [dropoffInput, setDropoffInput] = useState('');
  const [dropoffPoint, setDropoffPoint] = useState<RoutePoint | null>(null);
  const [destinationState, setDestinationState] = useState<DestinationState>('idle');
  const [destinationHint, setDestinationHint] = useState('Enter your drop-off to see the route and available carriers.');
  const [selectedVehicle, setSelectedVehicle] = useState(
    cargoVehicles.find((vehicle) => vehicle.key === 'pickup')?.key ?? cargoVehicles[0].key
  );
  const [expandedField, setExpandedField] = useState<'pickup' | 'dropoff' | null>(null);

  const activeVehicle =
    cargoVehicles.find((vehicle) => vehicle.key === selectedVehicle) ??
    cargoVehicles.find((vehicle) => vehicle.key === 'pickup') ??
    cargoVehicles[0];
  const dropoffText = dropoffInput.trim();
  const showVehicleSheet = dropoffText.length > 0;

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPickupLabel('Location permission is off. Using Dar es Salaam as pickup preview.');
          setPickupPoint({
            latitude: defaultRegion.latitude,
            longitude: defaultRegion.longitude,
          });
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        const point = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        };
        setPickupPoint(point);

        const address = await Location.reverseGeocodeAsync(point);
        setPickupLabel(formatPickupLabel(address[0] ?? null, point));

        mapRef.current?.animateToRegion(
          {
            ...point,
            latitudeDelta: 0.045,
            longitudeDelta: 0.04,
          },
          700
        );
      } catch {
        setPickupLabel('Unable to read your live pickup. Using map preview.');
        setPickupPoint({
          latitude: defaultRegion.latitude,
          longitude: defaultRegion.longitude,
        });
      }
    })();
  }, []);

  useEffect(() => {
    if (expandedField !== 'dropoff') {
      return;
    }

    const timer = setTimeout(() => {
      dropoffInputRef.current?.focus();
    }, 80);

    return () => clearTimeout(timer);
  }, [expandedField]);

  useEffect(() => {
    if (!pickupPoint) {
      return;
    }

    if (!dropoffText) {
      setDropoffPoint(null);
      setDestinationState('idle');
      setDestinationHint('Enter your drop-off to see the route and available carriers.');
      mapRef.current?.animateToRegion(
        {
          ...pickupPoint,
          latitudeDelta: 0.045,
          longitudeDelta: 0.04,
        },
        500
      );
      return;
    }

    setDestinationState('searching');
    setDestinationHint('Finding the drop-off on the map...');

    const timer = setTimeout(async () => {
      try {
        const matches = await Location.geocodeAsync(dropoffText);
        const firstMatch = matches[0];

        if (firstMatch) {
          const point = {
            latitude: firstMatch.latitude,
            longitude: firstMatch.longitude,
          };
          setDropoffPoint(point);
          setDestinationState('resolved');
          setDestinationHint('Drop-off found. Choose the cargo carrier that fits your load.');
          mapRef.current?.fitToCoordinates([pickupPoint, point], {
            edgePadding: { top: 220, right: 60, bottom: mapBottomEdgePadding, left: 60 },
            animated: true,
          });
          return;
        }

        const previewPoint = buildPreviewDestination(pickupPoint, dropoffText);
        setDropoffPoint(previewPoint);
        setDestinationState('preview');
        setDestinationHint('Previewing the route near your area. You can refine the drop-off if needed.');
        mapRef.current?.fitToCoordinates([pickupPoint, previewPoint], {
          edgePadding: { top: 220, right: 60, bottom: mapBottomEdgePadding, left: 60 },
          animated: true,
        });
      } catch {
        if (pickupPoint) {
          const previewPoint = buildPreviewDestination(pickupPoint, dropoffText);
          setDropoffPoint(previewPoint);
          setDestinationState('preview');
          setDestinationHint('Previewing the route near your area. You can refine the drop-off if needed.');
          mapRef.current?.fitToCoordinates([pickupPoint, previewPoint], {
            edgePadding: { top: 220, right: 60, bottom: mapBottomEdgePadding, left: 60 },
            animated: true,
          });
        } else {
          setDropoffPoint(null);
          setDestinationState('error');
          setDestinationHint('We could not place that drop-off yet. Edit it and try again.');
        }
      }
    }, 650);

    return () => clearTimeout(timer);
  }, [dropoffText, pickupPoint]);

  const routePoints = useMemo(() => {
    if (!pickupPoint || !dropoffPoint) {
      return [];
    }

    return [pickupPoint, dropoffPoint];
  }, [pickupPoint, dropoffPoint]);

  const handleContinue = () => {
    if (!dropoffText) {
      return;
    }

    router.push({
      pathname: '/order-review',
      params: {
        flow: 'cargo',
        vehicle: activeVehicle.key,
        timing: 'now',
        pickup: pickupLabel,
        dropoff: dropoffText,
      },
    });
  };

  const sheetTitle =
    destinationState === 'searching'
      ? 'Finding your drop-off'
      : destinationState === 'error'
        ? 'Update drop-off'
        : 'Choose cargo carrier';

  const pickupStatusText = pickupPoint ? 'Live current location' : 'Locating...';
  const routePanelTitle = showVehicleSheet ? 'Pickup and drop-off' : 'Where should we send the cargo?';
  const showVehicleSheetSubtitle = destinationState === 'searching' || destinationState === 'error';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={defaultRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        loadingEnabled>
        {pickupPoint ? (
          <Marker coordinate={pickupPoint} title="Pickup" description={pickupLabel} pinColor={cargoTheme.colors.primary} />
        ) : null}
        {dropoffPoint ? (
          <Marker coordinate={dropoffPoint} title="Drop-off" description={dropoffText} pinColor="#2563EB" />
        ) : null}
        {routePoints.length === 2 ? (
          <Polyline coordinates={routePoints} strokeColor={cargoTheme.colors.primary} strokeWidth={4} />
        ) : null}
      </MapView>

      <View style={styles.mapShade} />

      <View style={[styles.topOverlay, showVehicleSheet && styles.topOverlayWithVehicleSheet]}>
        <View style={[styles.chromeRow, showVehicleSheet && styles.chromeRowCompact]}>
          <TouchableOpacity style={styles.chromeButton} activeOpacity={0.88} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={cargoTheme.colors.text} />
          </TouchableOpacity>

          <View style={styles.titleChip}>
            <Text style={styles.titleChipText}>Book cargo carrier</Text>
          </View>

          <TouchableOpacity style={styles.chromeButton} activeOpacity={0.88} onPress={() => router.push('/menu')}>
            <MaterialCommunityIcons name="menu" size={22} color={cargoTheme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={[styles.routePanel, showVehicleSheet && styles.routePanelCompact]}>
          <Text style={[styles.routePanelTitle, showVehicleSheet && styles.routePanelTitleCompact]}>
            {routePanelTitle}
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.routeField,
              showVehicleSheet && styles.routeFieldCompact,
              expandedField === 'pickup' && styles.routeFieldExpanded,
            ]}
            onPress={() => {
              Keyboard.dismiss();
              setExpandedField((current) => (current === 'pickup' ? null : 'pickup'));
            }}>
            <View style={styles.routeRow}>
              <View style={[styles.routeIconWrap, styles.pickupIconWrap]}>
                <View style={styles.pickupDot} />
              </View>
              <View style={styles.routeCopy}>
                <Text style={styles.routeLabel}>Pickup</Text>
                <Text numberOfLines={expandedField === 'pickup' ? 2 : 1} style={styles.routeValue}>
                  {pickupLabel}
                </Text>
              </View>
              <MaterialCommunityIcons
                name={expandedField === 'pickup' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#94A3B8"
              />
            </View>

            {expandedField === 'pickup' ? (
              <View style={styles.routeExpandedContent}>
                <View style={styles.liveBadge}>
                  <View style={styles.liveBadgeDot} />
                  <Text style={styles.liveBadgeText}>{pickupStatusText}</Text>
                </View>
                <Text style={styles.routeExpandedText}>{pickupLabel}</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <View style={styles.routeDivider} />

          {expandedField === 'dropoff' ? (
            <View style={[styles.routeField, showVehicleSheet && styles.routeFieldCompact, styles.routeFieldExpanded]}>
              <View style={styles.routeRow}>
                <View style={[styles.routeIconWrap, styles.dropoffIconWrap]}>
                  <MaterialCommunityIcons name="flag-checkered" size={18} color="#2563EB" />
                </View>
                <View style={styles.routeCopy}>
                  <Text style={styles.routeLabel}>Drop-off</Text>
                  <TextInput
                    ref={dropoffInputRef}
                    value={dropoffInput}
                    onChangeText={setDropoffInput}
                    placeholder="Enter delivery destination"
                    placeholderTextColor="#94A3B8"
                    style={styles.routeInput}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                </View>
                <Pressable
                  hitSlop={10}
                  onPress={() => {
                    Keyboard.dismiss();
                    setExpandedField(null);
                  }}>
                  <MaterialCommunityIcons name="close" size={20} color="#94A3B8" />
                </Pressable>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.routeField, showVehicleSheet && styles.routeFieldCompact]}
              onPress={() => setExpandedField('dropoff')}>
              <View style={styles.routeRow}>
                <View style={[styles.routeIconWrap, styles.dropoffIconWrap]}>
                  <MaterialCommunityIcons name="flag-checkered" size={18} color="#2563EB" />
                </View>
                <View style={styles.routeCopy}>
                  <Text style={styles.routeLabel}>Drop-off</Text>
                  <Text style={[styles.routeValue, !dropoffText && styles.routePlaceholder]}>
                    {dropoffText || 'Tap to enter destination'}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#94A3B8" />
              </View>
            </TouchableOpacity>
          )}

          {showVehicleSheet ? null : <Text style={styles.routeHint}>{destinationHint}</Text>}
        </View>
      </View>

      {showVehicleSheet ? (
        <View style={styles.vehicleSheet}>
          <View style={styles.vehicleSheetHandle} />
          <Text style={styles.vehicleSheetTitle}>{sheetTitle}</Text>
          {showVehicleSheetSubtitle ? (
            <Text style={styles.vehicleSheetSubtitle}>
              {destinationState === 'searching'
                ? 'Preparing the route before showing carriers.'
                : 'Edit the drop-off until the map can place it.'}
            </Text>
          ) : null}

          {destinationState === 'searching' ? (
            <View style={styles.stateCard}>
              <ActivityIndicator size="small" color={cargoTheme.colors.primaryDark} />
              <Text style={styles.stateText}>Finding the best route preview...</Text>
            </View>
          ) : destinationState === 'error' ? (
            <View style={styles.stateCard}>
              <MaterialCommunityIcons name="map-marker-alert-outline" size={18} color="#DC2626" />
              <Text style={styles.stateText}>We could not locate that destination yet.</Text>
            </View>
          ) : (
            <>
              <ScrollView
                style={styles.vehicleListScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.vehicleList}>
                {cargoVehicles.map((vehicle) => {
                  const isActive = vehicle.key === selectedVehicle;
                  return (
                    <TouchableOpacity
                      key={vehicle.key}
                      style={[styles.vehicleCard, isActive && styles.vehicleCardActive]}
                      activeOpacity={0.9}
                      onPress={() => setSelectedVehicle(vehicle.key)}>
                      <View style={styles.vehicleImageWrap}>
                        <Image
                          source={vehicleImages[vehicle.key]}
                          style={styles.vehicleImage}
                          contentFit="contain"
                          transition={120}
                        />
                      </View>
                      <View style={styles.vehicleBody}>
                        <View style={styles.vehicleHeaderRow}>
                          <Text style={styles.vehicleTitle}>{vehicle.title}</Text>
                          <Text style={styles.vehiclePrice}>{vehicle.price}</Text>
                        </View>
                        <Text style={styles.vehicleMeta}>{vehicle.capacity}</Text>
                        <View style={styles.vehicleFooterRow}>
                          <Text style={styles.vehicleEta}>ETA {vehicle.eta}</Text>
                          {isActive ? <Text style={styles.vehicleSelected}>Selected</Text> : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.vehicleActionBar}>
                <View style={styles.selectionSummary}>
                  <Text style={styles.selectionLabel}>Selected carrier</Text>
                  <Text style={styles.selectionValue}>{activeVehicle.title}</Text>
                </View>
                <PrimaryButton label="Continue" icon="arrow-right" onPress={handleContinue} style={styles.ctaButton} />
              </View>
            </>
          )}
        </View>
      ) : (
        <View style={styles.promptCard}>
          <Text style={styles.promptTitle}>Enter a drop-off to unlock vehicle choices</Text>
          <Text style={styles.promptText}>
            The map will connect your pickup and destination, then show the available carriers.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: cargoTheme.colors.ink,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
  },
  topOverlay: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
  },
  topOverlayWithVehicleSheet: {
    bottom: topOverlayBottomInset,
  },
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  chromeRowCompact: {
    marginBottom: 10,
  },
  chromeButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  titleChip: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(15, 23, 42, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  titleChipText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  routePanel: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 28,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  routePanelCompact: {
    padding: 14,
  },
  routePanelTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 12,
  },
  routePanelTitleCompact: {
    fontSize: 16,
    lineHeight: 21,
    marginBottom: 8,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeField: {
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  routeFieldCompact: {
    paddingVertical: 6,
  },
  routeFieldExpanded: {
    backgroundColor: '#F8FAFC',
  },
  routeIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pickupIconWrap: {
    backgroundColor: '#ECFDF3',
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: cargoTheme.colors.primary,
  },
  dropoffIconWrap: {
    backgroundColor: '#EFF6FF',
  },
  routeCopy: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: cargoTheme.colors.subtext,
    marginBottom: 4,
  },
  routeValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    color: cargoTheme.colors.text,
  },
  routeInput: {
    fontSize: 16,
    fontWeight: '700',
    color: cargoTheme.colors.text,
    paddingVertical: 0,
    minHeight: 24,
  },
  routePlaceholder: {
    color: '#94A3B8',
  },
  routeExpandedContent: {
    marginTop: 12,
    marginLeft: 54,
    gap: 10,
  },
  routeExpandedText: {
    fontSize: 13,
    lineHeight: 19,
    color: cargoTheme.colors.subtext,
  },
  routeDivider: {
    height: 1,
    backgroundColor: '#E8EEF4',
    marginVertical: 14,
    marginLeft: 54,
  },
  liveBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ECFDF3',
  },
  liveBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: cargoTheme.colors.primary,
  },
  liveBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: cargoTheme.colors.primaryDark,
  },
  routeHint: {
    fontSize: 12,
    lineHeight: 18,
    color: cargoTheme.colors.primaryDark,
    marginTop: 12,
  },
  promptCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8EEF4',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  promptTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 6,
  },
  promptText: {
    fontSize: 13,
    lineHeight: 19,
    color: cargoTheme.colors.subtext,
  },
  vehicleSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#E8EEF4',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    maxHeight: vehicleSheetMaxHeight,
  },
  vehicleSheetHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D7DEE7',
    alignSelf: 'center',
    marginBottom: 14,
  },
  vehicleSheetTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 8,
  },
  vehicleSheetSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: cargoTheme.colors.subtext,
    marginBottom: 12,
  },
  stateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E8EEF4',
    borderRadius: 22,
    padding: 16,
  },
  stateText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: cargoTheme.colors.text,
    fontWeight: '700',
  },
  vehicleListScroll: {
    maxHeight: 300,
    marginBottom: 10,
  },
  vehicleList: {
    gap: 12,
    paddingBottom: 4,
  },
  vehicleCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E8EEF4',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  vehicleCardActive: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  vehicleImageWrap: {
    width: 78,
    height: 78,
    marginRight: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleImage: {
    width: 70,
    height: 70,
  },
  vehicleBody: {
    flex: 1,
    paddingRight: 4,
    paddingVertical: 2,
  },
  vehicleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  vehicleTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    color: cargoTheme.colors.text,
  },
  vehicleMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: cargoTheme.colors.subtext,
    marginBottom: 6,
  },
  vehicleFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleEta: {
    fontSize: 12,
    fontWeight: '700',
    color: cargoTheme.colors.subtext,
  },
  vehiclePrice: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    color: cargoTheme.colors.text,
  },
  vehicleSelected: {
    fontSize: 12,
    fontWeight: '800',
    color: cargoTheme.colors.primaryDark,
  },
  vehicleActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8EEF4',
    paddingTop: 14,
  },
  selectionSummary: {
    flex: 1,
  },
  selectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: cargoTheme.colors.subtext,
    marginBottom: 4,
  },
  selectionValue: {
    fontSize: 17,
    fontWeight: '900',
    color: cargoTheme.colors.text,
  },
  ctaButton: {
    minWidth: 150,
  },
});
