import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
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
import MapView, { Marker, Polyline } from 'react-native-maps';

import { PrimaryButton } from '@/components/cargo-ui';
import { cargoTheme, cargoVehicles } from '@/constants/cargo-theme';
import {
  formatDistance,
  formatDuration,
  getDistanceBetweenPoints,
  selectBestOsrmRoute,
  type RoutePoint,
} from '@/lib/route-utils';
import { getSavedPlaces, type SavedPlace } from '@/lib/saved-places';

type PickupState = 'loading' | 'ready' | 'error';
type DestinationState = 'idle' | 'searching' | 'resolved' | 'error';
type RouteSource = 'osrm' | 'fallback';

type RouteMetrics = {
  coordinates: RoutePoint[];
  geometry: string;
  distanceMeters: number;
  durationSeconds: number;
  source: RouteSource;
};

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

const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving';

const TANZANIA_MARKET_PROFILE = {
  urbanFuelPricePerLiter: 3820,
  regionalFuelPricePerLiter: 3905,
  targetUrbanSpeedKph: 24,
  targetRegionalSpeedKph: 54,
  congestionMarkupWeight: 0.38,
  roadComplexityWeight: 0.2,
  longHaulWeight: 0.11,
  demandBalanceWeight: 0.16,
} as const;

const vehicleOperatingProfiles = {
  kirikuu: {
    cruiseKmPerLiter: 33,
    idleLitersPerHour: 0.45,
    serviceIntensity: 1.7,
    maintenanceLoad: 0.65,
    marketLoad: 0.52,
  },
  pickup: {
    cruiseKmPerLiter: 8.8,
    idleLitersPerHour: 1.35,
    serviceIntensity: 1.82,
    maintenanceLoad: 0.92,
    marketLoad: 0.68,
  },
  toyo: {
    cruiseKmPerLiter: 4.6,
    idleLitersPerHour: 2.5,
    serviceIntensity: 2.08,
    maintenanceLoad: 1.16,
    marketLoad: 0.86,
  },
} as const;

const vehicleImages: Record<string, number> = {
  kirikuu: require('@/assets/images/kirikuu.png'),
  pickup: require('@/assets/images/pickup.png'),
  toyo: require('@/assets/images/toyo.png'),
};

function formatTzs(amount: number) {
  return `TZS ${Math.max(0, Math.round(amount)).toLocaleString('en-US')}`;
}

function getVehicleCapacityKg(capacityLabel: string) {
  const lower = capacityLabel.toLowerCase();
  const numericMatch = lower.match(/(\d+(?:\.\d+)?)/);
  const rawValue = numericMatch ? Number(numericMatch[1]) : 25;

  if (lower.includes('ton')) {
    return rawValue * 1000;
  }

  return rawValue;
}

function estimateDynamicCargoPrice(params: {
  vehicleKey: keyof typeof vehicleOperatingProfiles;
  capacityKg: number;
  distanceMeters: number;
  durationSeconds: number;
  straightLineDistanceMeters: number;
}) {
  const { vehicleKey, capacityKg, distanceMeters, durationSeconds, straightLineDistanceMeters } = params;
  const profile = vehicleOperatingProfiles[vehicleKey];
  const distanceKm = Math.max(distanceMeters / 1000, 0.35);
  const durationHours = Math.max(durationSeconds / 3600, 0.15);
  const averageSpeedKph = distanceKm / durationHours;
  const fuelPricePerLiter =
    distanceKm > 35 ? TANZANIA_MARKET_PROFILE.regionalFuelPricePerLiter : TANZANIA_MARKET_PROFILE.urbanFuelPricePerLiter;
  const targetSpeedKph =
    distanceKm > 35 ? TANZANIA_MARKET_PROFILE.targetRegionalSpeedKph : TANZANIA_MARKET_PROFILE.targetUrbanSpeedKph;
  const congestionFactor = Math.max(1, targetSpeedKph / Math.max(averageSpeedKph, 8));
  const roadComplexityFactor = Math.max(1, distanceMeters / Math.max(straightLineDistanceMeters, 250));
  const longHaulFactor = Math.max(0, distanceKm - 18) / 100;
  const capacityPressure = 1 + Math.log10(Math.max(capacityKg, 10)) / 2.8;
  const energyLiters =
    distanceKm / profile.cruiseKmPerLiter + durationHours * profile.idleLitersPerHour * congestionFactor;
  const energyCost = energyLiters * fuelPricePerLiter;
  const timePressureCost = energyCost * profile.serviceIntensity * durationHours;
  const maintenanceCost = energyCost * profile.maintenanceLoad * roadComplexityFactor;
  const marketPressure =
    1 +
    (congestionFactor - 1) * TANZANIA_MARKET_PROFILE.congestionMarkupWeight +
    (roadComplexityFactor - 1) * TANZANIA_MARKET_PROFILE.roadComplexityWeight +
    longHaulFactor * TANZANIA_MARKET_PROFILE.longHaulWeight +
    profile.marketLoad * TANZANIA_MARKET_PROFILE.demandBalanceWeight;

  return (energyCost + timePressureCost + maintenanceCost) * capacityPressure * marketPressure;
}

function buildFallbackRoute(pickupPoint: RoutePoint, dropoffPoint: RoutePoint): RouteMetrics {
  const distanceMeters = Math.max(getDistanceBetweenPoints(pickupPoint, dropoffPoint), 500);
  const averageSpeedKph = distanceMeters > 30000 ? 52 : 28;
  const durationSeconds = Math.max(Math.round(((distanceMeters / 1000) / averageSpeedKph) * 3600), 6 * 60);

  return {
    coordinates: [pickupPoint, dropoffPoint],
    geometry: '',
    distanceMeters,
    durationSeconds,
    source: 'fallback',
  };
}

function formatLocationLabel(
  address: Location.LocationGeocodedAddress | null,
  point: RoutePoint | null,
  fallbackText?: string
) {
  if (address) {
    const parts = [address.name, address.street, address.district, address.city, address.region].filter(Boolean);
    const unique = [...new Set(parts)];
    if (unique.length > 0) {
      return unique.slice(0, 3).join(', ');
    }
  }

  if (fallbackText?.trim()) {
    return fallbackText.trim();
  }

  if (point) {
    return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
  }

  return 'Detecting your current location...';
}

async function fetchBestRoute(pickupPoint: RoutePoint, dropoffPoint: RoutePoint) {
  const osrmResponse = await fetch(
    `${OSRM_ROUTE_URL}/${pickupPoint.longitude},${pickupPoint.latitude};${dropoffPoint.longitude},${dropoffPoint.latitude}?alternatives=true&overview=full&geometries=polyline`
  );

  if (!osrmResponse.ok) {
    throw new Error(`OSRM route request failed with ${osrmResponse.status}`);
  }

  const osrmData = (await osrmResponse.json()) as {
    code?: string;
    routes?: { geometry?: string; distance?: number; duration?: number }[];
  };
  const route = selectBestOsrmRoute(osrmData.routes);

  if (osrmData.code !== 'Ok' || !route) {
    throw new Error('OSRM did not return a usable route.');
  }

  return {
    ...route,
    source: 'osrm' as const,
  };
}

export default function BookCargoScreen() {
  const router = useRouter();
  const mapRef = React.useRef<MapView>(null);
  const dropoffLookupIdRef = useRef(0);
  const [pickupPoint, setPickupPoint] = useState<RoutePoint | null>(null);
  const [pickupLabel, setPickupLabel] = useState('Detecting your current location...');
  const [pickupState, setPickupState] = useState<PickupState>('loading');
  const [pickupHint, setPickupHint] = useState('Checking your current GPS pickup point...');
  const [dropoffInput, setDropoffInput] = useState('');
  const [dropoffPoint, setDropoffPoint] = useState<RoutePoint | null>(null);
  const [dropoffLabel, setDropoffLabel] = useState('');
  const [destinationState, setDestinationState] = useState<DestinationState>('idle');
  const [destinationHint, setDestinationHint] = useState('Enter the drop-off location and it will appear on the map.');
  const [routeMetrics, setRouteMetrics] = useState<RouteMetrics | null>(null);
  const [routeError, setRouteError] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(
    cargoVehicles.find((vehicle) => vehicle.key === 'pickup')?.key ?? cargoVehicles[0].key
  );
  const [formError, setFormError] = useState('');
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);

  const activeVehicle =
    cargoVehicles.find((vehicle) => vehicle.key === selectedVehicle) ??
    cargoVehicles.find((vehicle) => vehicle.key === 'pickup') ??
    cargoVehicles[0];
  const dropoffText = dropoffInput.trim();
  const showVehicleSheet = !!pickupPoint && !!dropoffPoint && !!routeMetrics;
  const routeStats =
    routeMetrics === null
      ? null
      : {
          distanceLabel: formatDistance(routeMetrics.distanceMeters),
          durationLabel: formatDuration(routeMetrics.durationSeconds),
        };

  const routePoints = useMemo(() => {
    if (routeMetrics?.coordinates.length) {
      return routeMetrics.coordinates;
    }

    if (!pickupPoint || !dropoffPoint) {
      return [];
    }

    return [pickupPoint, dropoffPoint];
  }, [dropoffPoint, pickupPoint, routeMetrics]);

  const vehicleQuotes = useMemo(() => {
    if (!routeMetrics || !pickupPoint || !dropoffPoint) {
      return {};
    }

    const straightLineDistanceMeters = getDistanceBetweenPoints(pickupPoint, dropoffPoint);

    return Object.fromEntries(
      cargoVehicles.map((vehicle) => [
        vehicle.key,
        estimateDynamicCargoPrice({
          vehicleKey: vehicle.key as keyof typeof vehicleOperatingProfiles,
          capacityKg: getVehicleCapacityKg(vehicle.capacity),
          distanceMeters: routeMetrics.distanceMeters,
          durationSeconds: routeMetrics.durationSeconds,
          straightLineDistanceMeters,
        }),
      ])
    ) as Record<string, number>;
  }, [dropoffPoint, pickupPoint, routeMetrics]);

  const activeVehiclePrice = vehicleQuotes[activeVehicle.key];

  useEffect(() => {
    void getSavedPlaces().then(setSavedPlaces);
  }, []);

  useEffect(() => {
    const loadPickupLocation = async () => {
      setPickupState('loading');
      setPickupHint('Checking your current GPS pickup point...');
      setFormError('');

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPickupState('error');
          setPickupPoint(null);
          setPickupLabel('Current GPS location is required for pickup.');
          setPickupHint('Enable device location permission to use your live pickup point.');
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const point = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        };
        setPickupPoint(point);

        const reverse = await Location.reverseGeocodeAsync(point);
        setPickupLabel(formatLocationLabel(reverse[0] ?? null, point));
        setPickupState('ready');
        setPickupHint('Current GPS pickup ready. Enter the drop-off and it will appear on the map.');

        mapRef.current?.animateToRegion(
          {
            ...point,
            latitudeDelta: 0.045,
            longitudeDelta: 0.04,
          },
          700
        );
      } catch {
        try {
          const fallbackLocation = await Location.getLastKnownPositionAsync();
          if (fallbackLocation) {
            const point = {
              latitude: fallbackLocation.coords.latitude,
              longitude: fallbackLocation.coords.longitude,
            };
            setPickupPoint(point);
            setPickupLabel(formatLocationLabel(null, point));
            setPickupState('ready');
            setPickupHint('Using your last known device location for pickup. Enter the drop-off and it will appear on the map.');
            mapRef.current?.animateToRegion(
              {
                ...point,
                latitudeDelta: 0.045,
                longitudeDelta: 0.04,
              },
              700
            );
            return;
          }
        } catch {
          // Ignore fallback lookup errors and show the main GPS error below.
        }

        setPickupState('error');
        setPickupPoint(null);
        setPickupLabel('Unable to read your current GPS location.');
        setPickupHint('Check location services on the device, then tap refresh.');
      }
    };

    void loadPickupLocation();
  }, []);

  useEffect(() => {
    if (!pickupPoint || dropoffText) {
      return;
    }

    mapRef.current?.animateToRegion(
      {
        ...pickupPoint,
        latitudeDelta: 0.045,
        longitudeDelta: 0.04,
      },
      500
    );
  }, [dropoffText, pickupPoint]);

  const resetDropoffSelection = (value: string) => {
    dropoffLookupIdRef.current += 1;
    setDropoffInput(value);
    setDropoffPoint(null);
    setDropoffLabel('');
    setRouteMetrics(null);
    setRouteError('');
    setDestinationState('idle');
    setFormError('');
    setDestinationHint(
      value.trim()
        ? 'Typing the drop-off now. It will appear on the map in a moment.'
        : 'Enter the drop-off location and it will appear on the map.'
    );
  };

  const clearDropoffSelection = () => {
    resetDropoffSelection('');
    Keyboard.dismiss();
    if (pickupPoint) {
      mapRef.current?.animateToRegion(
        {
          ...pickupPoint,
          latitudeDelta: 0.045,
          longitudeDelta: 0.04,
        },
        500
      );
    }
  };

  const applySavedPlaceToPickup = async (place: SavedPlace) => {
    try {
      const matches = await Location.geocodeAsync(place.address);
      const match = matches[0];

      if (!match) {
        throw new Error('No location match');
      }

      const point = {
        latitude: match.latitude,
        longitude: match.longitude,
      };

      setPickupPoint(point);
      setPickupLabel(place.address);
      setPickupState('ready');
      setPickupHint('Saved pickup loaded. Enter the drop-off and it will appear on the map.');
      setDropoffPoint(null);
      setDropoffLabel('');
      setRouteMetrics(null);
      setRouteError('');
      setDestinationState('idle');
      setDestinationHint('Enter the drop-off location and it will appear on the map.');
      mapRef.current?.animateToRegion(
        {
          ...point,
          latitudeDelta: 0.045,
          longitudeDelta: 0.04,
        },
        700
      );
    } catch {
      setFormError('We could not place this saved pickup on the map. Try a clearer saved address.');
    }
  };

  const resolveAndRouteDropoff = useCallback(async (options?: { query?: string; manual?: boolean }) => {
    const query = options?.query?.trim() ?? dropoffText;
    const manual = options?.manual ?? true;

    if (!pickupPoint) {
      setFormError('Waiting for the current GPS pickup location.');
      return;
    }

    if (!query) {
      if (manual) {
        setDestinationState('error');
        setRouteError('Enter the drop-off location first.');
        setDestinationHint('Type an area, street, building, or landmark.');
      }
      return;
    }

    const lookupId = dropoffLookupIdRef.current + 1;
    dropoffLookupIdRef.current = lookupId;

    Keyboard.dismiss();
    setDestinationState('searching');
    setRouteError('');
    setDestinationHint(manual ? 'Placing the drop-off on the map...' : 'Updating the drop-off on the map...');
    setFormError('');

    try {
      const matches = await Location.geocodeAsync(query);
      if (lookupId !== dropoffLookupIdRef.current) {
        return;
      }

      const firstMatch = matches[0];
      if (!firstMatch) {
        throw new Error('We could not place that drop-off on the map yet.');
      }

      const point = {
        latitude: firstMatch.latitude,
        longitude: firstMatch.longitude,
      };

      let resolvedLabel = query;
      try {
        const reverse = await Location.reverseGeocodeAsync(point);
        if (lookupId !== dropoffLookupIdRef.current) {
          return;
        }
        resolvedLabel = formatLocationLabel(reverse[0] ?? null, point, query);
      } catch {
        resolvedLabel = query;
      }

      let nextRoute: RouteMetrics;
      let routeNote =
        'The shortest available drivable route is ready. You can now choose a vehicle below.';

      try {
        nextRoute = await fetchBestRoute(pickupPoint, point);
      } catch {
        nextRoute = buildFallbackRoute(pickupPoint, point);
        routeNote = 'The drop-off is pinned on the map. A direct distance fallback is being used because live routing was unavailable.';
      }

      if (lookupId !== dropoffLookupIdRef.current) {
        return;
      }

      setDropoffPoint(point);
      setDropoffLabel(resolvedLabel);
      setRouteMetrics(nextRoute);
      setDestinationState('resolved');
      setDestinationHint(`${resolvedLabel} is ready. ${routeNote}`);

      const fitPoints = nextRoute.coordinates.length >= 2 ? nextRoute.coordinates : [pickupPoint, point];
      mapRef.current?.fitToCoordinates(fitPoints, {
        edgePadding: { top: 220, right: 60, bottom: mapBottomEdgePadding, left: 60 },
        animated: true,
      });
    } catch (error) {
      if (lookupId !== dropoffLookupIdRef.current) {
        return;
      }

      setDropoffPoint(null);
      setDropoffLabel('');
      setRouteMetrics(null);

      if (manual) {
        setDestinationState('error');
        setRouteError(error instanceof Error ? error.message : 'We could not place that drop-off yet.');
        setDestinationHint('Add a clearer area, street, junction, building, or landmark for a more exact location.');
        return;
      }

      setDestinationState('idle');
      setRouteError('');
      setDestinationHint('Keep typing the drop-off and it will appear on the map when the location is clear enough.');
    }
  }, [dropoffText, pickupPoint]);

  useEffect(() => {
    if (!pickupPoint || dropoffText.length < 3) {
      return;
    }

    const timeout = setTimeout(() => {
      void resolveAndRouteDropoff({ query: dropoffText, manual: false });
    }, 650);

    return () => {
      clearTimeout(timeout);
    };
  }, [dropoffText, pickupPoint, resolveAndRouteDropoff]);

  const handleContinue = () => {
    if (!pickupPoint) {
      setFormError('Waiting for the current GPS pickup location.');
      return;
    }

    if (!dropoffPoint || !routeMetrics) {
      setFormError('Search the drop-off so it appears on the map before continuing.');
      return;
    }

    setFormError('');
    router.push({
      pathname: '/order-review',
      params: {
        flow: 'cargo',
        vehicle: activeVehicle.key,
        timing: 'now',
        pickup: pickupLabel,
        pickupLat: String(pickupPoint.latitude),
        pickupLng: String(pickupPoint.longitude),
        dropoff: dropoffLabel || dropoffText,
        dropoffLat: String(dropoffPoint.latitude),
        dropoffLng: String(dropoffPoint.longitude),
        distance: formatDistance(routeMetrics.distanceMeters),
        duration: formatDuration(routeMetrics.durationSeconds),
        price: typeof activeVehiclePrice === 'number' ? formatTzs(activeVehiclePrice) : activeVehicle.price,
      },
    });
  };

  const showPickupError = pickupState === 'error';
  const showDropoffError = destinationState === 'error' && !!routeError;
  const routePanelHint = showDropoffError ? routeError : destinationState === 'resolved' || dropoffText ? destinationHint : pickupHint;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <MapView
        ref={mapRef}
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
          <Marker coordinate={dropoffPoint} title="Drop-off" description={dropoffLabel || dropoffText} pinColor="#2563EB" />
        ) : null}
        {routePoints.length >= 2 ? (
          <Polyline coordinates={routePoints} strokeColor={cargoTheme.colors.primary} strokeWidth={4} />
        ) : null}
      </MapView>

      <View style={styles.mapShade} />

      <View style={[styles.topOverlay, showVehicleSheet && styles.topOverlayWithVehicleSheet]}>
        <View style={styles.chromeRow}>
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

        <View style={styles.routePanel}>
          <Text style={styles.routePanelTitle}>
            Pickup and drop-off
          </Text>

          <View style={[styles.routeField, styles.routeFieldExpanded]}>
            <View style={styles.routeRow}>
              <View style={[styles.routeIconWrap, styles.pickupIconWrap]}>
                <View style={styles.pickupDot} />
              </View>
              <View style={styles.routeCopy}>
                <Text style={styles.routeLabel}>Pickup</Text>
                <Text style={styles.routeValue}>{pickupLabel}</Text>
              </View>
              {pickupState === 'loading' ? (
                <ActivityIndicator size="small" color={cargoTheme.colors.primaryDark} />
              ) : (
                <Pressable
                  hitSlop={10}
                  onPress={() => {
                    setPickupState('loading');
                    setPickupHint('Refreshing your current GPS pickup point...');
                    setDropoffPoint(null);
                    setDropoffLabel('');
                    setRouteMetrics(null);
                    setRouteError('');
                    setDestinationState('idle');
                    setDestinationHint('Enter the drop-off location and it will appear on the map.');
                    setFormError('');
                    void (async () => {
                      try {
                        const { status } = await Location.requestForegroundPermissionsAsync();
                        if (status !== 'granted') {
                          setPickupState('error');
                          setPickupPoint(null);
                          setPickupLabel('Current GPS location is required for pickup.');
                          setPickupHint('Enable device location permission to use your live pickup point.');
                          return;
                        }

                        const currentLocation = await Location.getCurrentPositionAsync({
                          accuracy: Location.Accuracy.Balanced,
                        });
                        const point = {
                          latitude: currentLocation.coords.latitude,
                          longitude: currentLocation.coords.longitude,
                        };
                        setPickupPoint(point);
                        const reverse = await Location.reverseGeocodeAsync(point);
                        setPickupLabel(formatLocationLabel(reverse[0] ?? null, point));
                        setPickupState('ready');
                        setPickupHint('Current GPS pickup ready. Enter the drop-off and it will appear on the map.');
                        mapRef.current?.animateToRegion(
                          {
                            ...point,
                            latitudeDelta: 0.045,
                            longitudeDelta: 0.04,
                          },
                          700
                        );
                      } catch {
                        setPickupState('error');
                        setPickupPoint(null);
                        setPickupLabel('Unable to read your current GPS location.');
                        setPickupHint('Check location services on the device, then tap refresh.');
                      }
                    })();
                  }}>
                  <MaterialCommunityIcons name="crosshairs-gps" size={22} color={cargoTheme.colors.primaryDark} />
                </Pressable>
              )}
            </View>

            {savedPlaces.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedPlacesRow}>
                {savedPlaces.map((place) => (
                  <TouchableOpacity
                    key={place.id}
                    activeOpacity={0.88}
                    style={styles.savedPlaceChip}
                    onPress={() => {
                      void applySavedPlaceToPickup(place);
                    }}>
                    <MaterialCommunityIcons name={place.icon} size={16} color={cargoTheme.colors.primaryDark} />
                    <Text style={styles.savedPlaceChipText}>Use {place.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <View style={styles.routeDivider} />

          <View style={[styles.routeField, styles.routeFieldExpanded]}>
            <View style={styles.routeRow}>
              <View style={[styles.routeIconWrap, styles.dropoffIconWrap]}>
                <MaterialCommunityIcons name="flag-checkered" size={18} color="#2563EB" />
              </View>
              <View style={styles.routeCopy}>
                <Text style={styles.routeLabel}>Drop-off</Text>
                <TextInput
                  value={dropoffInput}
                  onChangeText={resetDropoffSelection}
                  placeholder="Enter delivery destination"
                  placeholderTextColor="#94A3B8"
                  style={styles.routeInput}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={() => {
                    void resolveAndRouteDropoff({ manual: true });
                  }}
                />
              </View>
              <View style={styles.routeActions}>
                {dropoffText ? (
                  <Pressable hitSlop={10} onPress={clearDropoffSelection}>
                    <MaterialCommunityIcons name="close" size={20} color="#94A3B8" />
                  </Pressable>
                ) : null}
                {destinationState === 'searching' ? (
                  <ActivityIndicator size="small" color={cargoTheme.colors.primaryDark} />
                ) : (
                  <Pressable
                    hitSlop={10}
                    onPress={() => {
                      void resolveAndRouteDropoff({ manual: true });
                    }}>
                  <MaterialCommunityIcons name="magnify" size={22} color={cargoTheme.colors.primaryDark} />
                  </Pressable>
                )}
              </View>
            </View>
          </View>

          <Text style={[styles.routeHint, (showPickupError || showDropoffError) && styles.routeHintError]}>
            {showDropoffError ? routeError : destinationState === 'resolved' ? destinationHint : routePanelHint}
          </Text>
        </View>
      </View>

      {showVehicleSheet ? (
        <View style={styles.vehicleSheet}>
          <View style={styles.vehicleSheetHandle} />
          <Text style={styles.vehicleSheetTitle}>Choose cargo carrier</Text>
          <Text style={styles.vehicleSheetSubtitle}>
            {routeStats
              ? `${routeStats.distanceLabel} ${routeMetrics?.source === 'fallback' ? 'direct estimate' : 'road distance'} • ${routeStats.durationLabel} travel time`
              : 'Pickup and drop-off are on the map.'}
          </Text>

          <ScrollView
            style={styles.vehicleListScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.vehicleList}>
            {cargoVehicles.map((vehicle) => {
              const isActive = vehicle.key === selectedVehicle;
              const vehiclePrice = vehicleQuotes[vehicle.key];

              return (
                <TouchableOpacity
                  key={vehicle.key}
                  style={[styles.vehicleCard, isActive && styles.vehicleCardActive]}
                  activeOpacity={0.9}
                  onPress={() => {
                    setSelectedVehicle(vehicle.key);
                    setFormError('');
                  }}>
                  <View style={styles.vehicleImageWrap}>
                    <Image source={vehicleImages[vehicle.key]} style={styles.vehicleImage} resizeMode="contain" />
                  </View>
                  <View style={styles.vehicleBody}>
                    <View style={styles.vehicleHeaderRow}>
                      <Text style={styles.vehicleTitle}>{vehicle.title}</Text>
                      <Text style={styles.vehiclePrice}>
                        {typeof vehiclePrice === 'number' ? formatTzs(vehiclePrice) : vehicle.price}
                      </Text>
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
              {typeof activeVehiclePrice === 'number' ? (
                <Text style={styles.selectionMeta}>
                  {formatTzs(activeVehiclePrice)}
                  {routeStats ? ` • ${routeStats.distanceLabel} • ${routeStats.durationLabel}` : ''}
                </Text>
              ) : (
                <Text style={styles.selectionMeta}>{activeVehicle.price}</Text>
              )}
              <Text numberOfLines={2} style={styles.selectionRoute}>
                {pickupLabel} to {dropoffLabel || dropoffText}
              </Text>
              {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            </View>
            <PrimaryButton label="Continue" icon="arrow-right" onPress={handleContinue} style={styles.ctaButton} />
          </View>
        </View>
      ) : (
        <View style={styles.promptCard}>
          <Text style={styles.promptTitle}>Enter drop-off to place it on the map</Text>
          <Text style={styles.promptText}>
            The pickup comes from the user&apos;s current GPS position. Type the drop-off normally and it will appear on
            the map, then vehicle selection opens below.
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
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 28,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  routePanelTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 12,
  },
  routeField: {
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  routeFieldExpanded: {
    backgroundColor: '#F8FAFC',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: cargoTheme.colors.text,
  },
  routeInput: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: cargoTheme.colors.text,
    paddingVertical: 0,
    minHeight: 24,
  },
  routeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 12,
  },
  routeDivider: {
    height: 1,
    backgroundColor: '#E8EEF4',
    marginVertical: 14,
    marginLeft: 54,
  },
  savedPlacesRow: {
    gap: 10,
    paddingTop: 10,
  },
  savedPlaceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDF4',
  },
  savedPlaceChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: cargoTheme.colors.primaryDark,
  },
  routeHint: {
    fontSize: 12,
    lineHeight: 18,
    color: cargoTheme.colors.primaryDark,
    marginTop: 12,
  },
  routeHintError: {
    color: '#B91C1C',
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 20,
  },
  vehicleSheetHandle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    marginBottom: 12,
  },
  vehicleSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: cargoTheme.colors.text,
  },
  vehicleSheetSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: cargoTheme.colors.subtext,
    marginTop: 4,
    marginBottom: 16,
  },
  vehicleListScroll: {
    flexGrow: 0,
    maxHeight: 210,
  },
  vehicleList: {
    gap: 12,
    paddingBottom: 6,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  vehicleCardActive: {
    borderColor: cargoTheme.colors.primary,
    backgroundColor: '#F0FDF4',
  },
  vehicleImageWrap: {
    width: 82,
    height: 62,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
  },
  vehicleImage: {
    width: '86%',
    height: '86%',
  },
  vehicleBody: {
    flex: 1,
  },
  vehicleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  vehicleTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: cargoTheme.colors.text,
  },
  vehiclePrice: {
    fontSize: 14,
    fontWeight: '800',
    color: cargoTheme.colors.primaryDark,
  },
  vehicleMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: cargoTheme.colors.subtext,
    marginTop: 5,
  },
  vehicleFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  vehicleEta: {
    fontSize: 12,
    fontWeight: '700',
    color: cargoTheme.colors.text,
  },
  vehicleSelected: {
    fontSize: 12,
    fontWeight: '800',
    color: cargoTheme.colors.primary,
  },
  vehicleActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  selectionSummary: {
    flex: 1,
  },
  selectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: cargoTheme.colors.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  selectionValue: {
    fontSize: 16,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginTop: 2,
  },
  selectionMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: cargoTheme.colors.subtext,
    marginTop: 4,
  },
  selectionRoute: {
    fontSize: 12,
    lineHeight: 18,
    color: cargoTheme.colors.primaryDark,
    marginTop: 6,
  },
  formError: {
    fontSize: 12,
    lineHeight: 18,
    color: '#B91C1C',
    marginTop: 8,
  },
  ctaButton: {
    minWidth: 132,
  },
});
