import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { getFirebaseAuthErrorMessage, getFirebaseDataErrorMessage } from './lib/auth-errors';
import {
  formatDeliveryDateTime,
  getDeliveryOrderStatusLabel,
  recordDriverAppOpen,
  registerDriver,
  setDriverAvailability,
  subscribeToDriver,
  subscribeToDriverOrders,
  updateDriverLocation,
  updateDriverOrderStatus,
  type DeliveryOrder,
  type DeliveryOrderStatus,
  type DriverRecord,
  type DriverVehicleType,
} from './lib/driver-data';
import { auth } from './lib/firebase';
import { normalizePhoneNumber } from './lib/phone-auth';

type AuthMode = 'signin' | 'register';
type DriverTab = 'orders' | 'trip' | 'account';
type FeedbackTone = 'error' | 'info' | 'success';
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type TripAction = {
  label: string;
  nextStatus: 'driver_at_pickup' | 'in_transit' | 'delivered';
  icon: IconName;
};
type RegisterFormState = {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  vehicleType: DriverVehicleType;
  vehicleLabel: string;
  vehicleColor: string;
  plateNumber: string;
};
type ProfileSetupState = {
  fullName: string;
  phoneNumber: string;
  vehicleType: DriverVehicleType;
  vehicleLabel: string;
  vehicleColor: string;
  plateNumber: string;
};

const ACTIVE_ORDER_STATUSES: DeliveryOrderStatus[] = ['driver_assigned', 'driver_at_pickup', 'in_transit'];
const vehicleTypeOptions: { key: DriverVehicleType; label: string; icon: IconName }[] = [
  { key: 'motorbike', label: 'Motorbike', icon: 'motorbike' },
  { key: 'pickup', label: 'Pickup', icon: 'car-pickup' },
  { key: 'van', label: 'Van', icon: 'van-utility' },
  { key: 'truck', label: 'Truck', icon: 'truck-outline' },
];
const tabs: { key: DriverTab; label: string; icon: IconName }[] = [
  { key: 'orders', label: 'Orders', icon: 'clipboard-list-outline' },
  { key: 'trip', label: 'Trip', icon: 'map-marker-path' },
  { key: 'account', label: 'Account', icon: 'account-circle-outline' },
];

const driveTheme = {
  colors: {
    primary: '#0F9D58',
    primaryDark: '#0B5A34',
    primarySoft: '#DCFCE7',
    accent: '#F97316',
    canvas: '#F5F7F6',
    surface: '#FFFFFF',
    dark: '#0F172A',
    ink: '#111827',
    subtext: '#64748B',
    line: '#E2E8F0',
    info: '#2563EB',
    warning: '#EA580C',
    danger: '#DC2626',
  },
  radius: {
    lg: 22,
    xl: 28,
    pill: 999,
  },
};

function getInitialRegisterForm(): RegisterFormState {
  return {
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    vehicleType: 'pickup',
    vehicleLabel: '',
    vehicleColor: '',
    plateNumber: '',
  };
}

function getInitialProfileSetup(user?: User | null): ProfileSetupState {
  return {
    fullName: user?.displayName?.trim() || '',
    phoneNumber: '',
    vehicleType: 'pickup',
    vehicleLabel: '',
    vehicleColor: '',
    plateNumber: '',
  };
}

function isActiveOrderStatus(status?: DeliveryOrderStatus) {
  return !!status && ACTIVE_ORDER_STATUSES.includes(status);
}

function getNextTripAction(status?: DeliveryOrderStatus): TripAction | null {
  switch (status) {
    case 'driver_assigned':
      return { label: 'Arrived at pickup', nextStatus: 'driver_at_pickup' as const, icon: 'map-marker-check-outline' };
    case 'driver_at_pickup':
      return { label: 'Start trip', nextStatus: 'in_transit' as const, icon: 'road-variant' };
    case 'in_transit':
      return { label: 'Mark delivered', nextStatus: 'delivered' as const, icon: 'check-circle-outline' };
    default:
      return null;
  }
}

function haversineDistanceKm(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number }
) {
  const earthRadiusKm = 6371;
  const dLat = ((end.latitude - start.latitude) * Math.PI) / 180;
  const dLng = ((end.longitude - start.longitude) * Math.PI) / 180;
  const startLat = (start.latitude * Math.PI) / 180;
  const endLat = (end.latitude * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistanceKm(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.max(0.1, Math.round(distanceKm * 10) / 10).toFixed(1)} km away`;
  }

  return `${distanceKm.toFixed(1)} km away`;
}

function getFallbackDropoffPoint(pickupPoint: { latitude: number; longitude: number }) {
  return {
    latitude: pickupPoint.latitude + 0.014,
    longitude: pickupPoint.longitude + 0.018,
  };
}

function interpolatePoint(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number },
  progress: number
) {
  const safeProgress = Math.max(0, Math.min(1, progress));

  return {
    latitude: start.latitude + (end.latitude - start.latitude) * safeProgress,
    longitude: start.longitude + (end.longitude - start.longitude) * safeProgress,
  };
}

function FeedbackBanner({ tone, message }: { tone: FeedbackTone; message: string }) {
  const toneStyle =
    tone === 'success'
      ? styles.feedbackSuccess
      : tone === 'error'
        ? styles.feedbackError
        : styles.feedbackInfo;

  return (
    <View style={[styles.feedbackBanner, toneStyle]}>
      <Text style={styles.feedbackText}>{message}</Text>
    </View>
  );
}

function AppButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
  icon,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'dark';
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}) {
  const buttonStyle =
    variant === 'primary'
      ? styles.buttonPrimary
      : variant === 'dark'
        ? styles.buttonDark
        : styles.buttonSecondary;
  const textStyle = variant === 'secondary' ? styles.buttonTextSecondary : styles.buttonTextPrimary;
  const iconColor = variant === 'secondary' ? driveTheme.colors.ink : '#FFFFFF';

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonBase,
        buttonStyle,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}>
      <View style={styles.buttonInner}>
        <Text style={textStyle}>{label}</Text>
        {icon ? <MaterialCommunityIcons name={icon} size={18} color={iconColor} /> : null}
      </View>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize = 'words',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        secureTextEntry={secureTextEntry}
        style={styles.textInput}
      />
    </View>
  );
}

function VehicleTypePicker({
  value,
  onChange,
}: {
  value: DriverVehicleType;
  onChange: (nextValue: DriverVehicleType) => void;
}) {
  return (
    <View style={styles.vehiclePicker}>
      {vehicleTypeOptions.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[styles.vehicleChip, selected && styles.vehicleChipActive]}>
            <MaterialCommunityIcons
              name={option.icon}
              size={18}
              color={selected ? driveTheme.colors.primaryDark : driveTheme.colors.subtext}
            />
            <Text style={[styles.vehicleChipText, selected && styles.vehicleChipTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function TripStopRow({
  tone,
  title,
  label,
}: {
  tone: 'pickup' | 'dropoff';
  title: string;
  label: string;
}) {
  return (
    <View style={styles.tripStopRow}>
      <View style={[styles.tripStopDot, tone === 'pickup' ? styles.tripStopPickup : styles.tripStopDropoff]} />
      <View style={styles.tripStopCopy}>
        <Text style={styles.tripStopTitle}>{title}</Text>
        <Text style={styles.tripStopLabel}>{label}</Text>
      </View>
    </View>
  );
}

function TripMetricChip({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
}) {
  return (
    <View style={styles.tripMetricChip}>
      <MaterialCommunityIcons name={icon} size={16} color={driveTheme.colors.primaryDark} />
      <Text style={styles.tripMetricText}>{label}</Text>
    </View>
  );
}

function MetricTile({
  icon,
  value,
  label,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  value: string;
  label: string;
}) {
  return (
    <View style={styles.metricTile}>
      <View style={styles.metricTileIconWrap}>
        <MaterialCommunityIcons name={icon} size={18} color={driveTheme.colors.primaryDark} />
      </View>
      <Text style={styles.metricTileValue}>{value}</Text>
      <Text style={styles.metricTileLabel}>{label}</Text>
    </View>
  );
}

function TripMap({
  pickupPoint,
  dropoffPoint,
  driverPoint,
  statusLabel,
  onOpenNavigation,
}: {
  pickupPoint: { latitude: number; longitude: number };
  dropoffPoint: { latitude: number; longitude: number };
  driverPoint: { latitude: number; longitude: number } | null;
  statusLabel: string;
  onOpenNavigation: () => void;
}) {
  const fallbackMap = (
    <View style={styles.mapFallbackShell}>
      <View style={styles.mapFallbackScene}>
        <View style={styles.mapFallbackGlowA} />
        <View style={styles.mapFallbackGlowB} />
        <View style={styles.mapRouteLine} />
        <View style={[styles.mapNode, styles.mapNodePickup]}>
          <View style={styles.mapNodeInner} />
        </View>
        <View style={[styles.mapNode, styles.mapNodeDropoff]}>
          <View style={styles.mapNodeInner} />
        </View>
        <View style={[styles.mapNode, styles.mapNodeDriver]}>
          <MaterialCommunityIcons name="car-outline" size={14} color="#FFFFFF" />
        </View>
      </View>
      <View style={styles.mapFallbackCard}>
        <Text style={styles.mapFallbackTitle}>Route guidance</Text>
        <Text style={styles.mapFallbackText}>Pickup point and destination are loaded for this trip.</Text>
        <Text style={styles.mapFallbackText}>
          Pickup: {pickupPoint.latitude.toFixed(5)}, {pickupPoint.longitude.toFixed(5)}
        </Text>
        <Text style={styles.mapFallbackText}>
          Drop-off: {dropoffPoint.latitude.toFixed(5)}, {dropoffPoint.longitude.toFixed(5)}
        </Text>
        {driverPoint ? (
          <Text style={styles.mapFallbackText}>
            Driver: {driverPoint.latitude.toFixed(5)}, {driverPoint.longitude.toFixed(5)}
          </Text>
        ) : null}
        <AppButton label="Open navigation" icon="navigation-variant-outline" onPress={onOpenNavigation} />
      </View>
    </View>
  );

  if (Platform.OS === 'web') {
    return fallbackMap;
  }

  const routePoints = driverPoint ? [pickupPoint, driverPoint, dropoffPoint] : [pickupPoint, dropoffPoint];

  return (
    <View style={styles.mapCard}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.mapView}
        mapType="standard"
        showsCompass
        showsTraffic={false}
        toolbarEnabled={false}
        showsUserLocation={false}
        loadingEnabled
        initialRegion={{
          latitude: (pickupPoint.latitude + dropoffPoint.latitude) / 2,
          longitude: (pickupPoint.longitude + dropoffPoint.longitude) / 2,
          latitudeDelta: Math.max(Math.abs(pickupPoint.latitude - dropoffPoint.latitude) * 2, 0.04),
          longitudeDelta: Math.max(Math.abs(pickupPoint.longitude - dropoffPoint.longitude) * 2, 0.04),
        }}>
        <Marker coordinate={pickupPoint} title="Pickup" description="Pickup point" pinColor="#F97316" />
        <Marker coordinate={dropoffPoint} title="Drop-off" description="Drop-off point" pinColor="#0F9D58" />
        {driverPoint ? (
          <Marker coordinate={driverPoint} title="Driver" description="Current driver location" pinColor="#2563EB" />
        ) : null}
        <Polyline coordinates={routePoints} strokeColor="#0F9D58" strokeWidth={4} />
      </MapView>
      <View pointerEvents="box-none" style={styles.mapOverlay}>
        <View style={styles.mapOverlayTop}>
          <View style={styles.mapBadge}>
            <MaterialCommunityIcons name="map-marker-path" size={14} color="#FFFFFF" />
            <Text style={styles.mapBadgeText}>{statusLabel}</Text>
          </View>
          <View style={styles.mapBadgeMuted}>
            <MaterialCommunityIcons name="navigation-variant-outline" size={14} color={driveTheme.colors.ink} />
            <Text style={styles.mapBadgeMutedText}>Route loaded</Text>
          </View>
        </View>
        <View style={styles.mapOverlayBottom}>
          <Pressable onPress={onOpenNavigation} style={({ pressed }) => [styles.mapNavButton, pressed && styles.buttonPressed]}>
            <MaterialCommunityIcons name="navigation-variant-outline" size={18} color="#FFFFFF" />
            <Text style={styles.mapNavButtonText}>Open navigation</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function DoorDriveApp() {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [driverOrdersLoading, setDriverOrdersLoading] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [selectedTab, setSelectedTab] = useState<DriverTab>('orders');
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null);
  const [locationPermission, setLocationPermission] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [locationLabel, setLocationLabel] = useState('Location sync has not started yet.');
  const [driverProfile, setDriverProfile] = useState<DriverRecord | null>(null);
  const [driverOrders, setDriverOrders] = useState<DeliveryOrder[]>([]);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerForm, setRegisterForm] = useState<RegisterFormState>(getInitialRegisterForm());
  const [profileSetup, setProfileSetup] = useState<ProfileSetupState>(getInitialProfileSetup(null));

  const normalizedRegisterPhone = useMemo(() => normalizePhoneNumber(registerForm.phoneNumber), [registerForm.phoneNumber]);
  const normalizedSetupPhone = useMemo(() => normalizePhoneNumber(profileSetup.phoneNumber), [profileSetup.phoneNumber]);
  const driverProfileMissing =
    !!authUser &&
    !profileLoading &&
    (!driverProfile ||
      !driverProfile.fullName?.trim() ||
      !driverProfile.phoneNumber?.trim() ||
      !driverProfile.vehicleLabel?.trim() ||
      !driverProfile.plateNumber?.trim());
  const hasReadyDriverProfile = !!driverProfile && !driverProfileMissing;
  const activeOrder = useMemo(
    () => driverOrders.find((order) => isActiveOrderStatus(order.status)) ?? null,
    [driverOrders]
  );
  const recentOrders = useMemo(
    () => driverOrders.filter((order) => !isActiveOrderStatus(order.status)).slice(0, 5),
    [driverOrders]
  );
  const availabilityLabel = activeOrder
    ? 'Busy on active trip'
    : driverProfile?.isAvailable
      ? 'Online for dispatch'
      : 'Offline from dispatch';
  const availabilityNote = activeOrder
    ? 'Dispatch can see that you are currently handling a live order.'
    : driverProfile?.isAvailable
      ? 'Admin can assign work to you now.'
      : 'Admin will not assign new work until you go online.';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setAuthUser(nextUser);
      setAuthInitializing(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authUser) {
      setDriverProfile(null);
      setDriverOrders([]);
      setProfileLoading(false);
      setDriverOrdersLoading(false);
      return;
    }

    setProfileLoading(true);
    setDriverOrdersLoading(true);

    const unsubscribeDriver = subscribeToDriver(
      authUser.uid,
      (nextDriver) => {
        setDriverProfile(nextDriver);
        setProfileLoading(false);
      },
      (error) => {
        setFeedback({
          tone: 'error',
          message:
            error instanceof FirebaseError
              ? getFirebaseDataErrorMessage(error.code, 'Could not load the driver profile right now.')
              : 'Could not load the driver profile right now.',
        });
        setProfileLoading(false);
      }
    );

    const unsubscribeDriverOrders = subscribeToDriverOrders(
      authUser.uid,
      (orders) => {
        setDriverOrders(orders);
        setDriverOrdersLoading(false);
      },
      (error) => {
        setFeedback({
          tone: 'error',
          message:
            error instanceof FirebaseError
              ? getFirebaseDataErrorMessage(error.code, 'Could not load your delivery feed right now.')
              : 'Could not load your delivery feed right now.',
        });
        setDriverOrdersLoading(false);
      }
    );

    return () => {
      unsubscribeDriver();
      unsubscribeDriverOrders();
    };
  }, [authUser]);

  useEffect(() => {
    if (!authUser || !driverProfileMissing) {
      return;
    }

    setProfileSetup((current) => ({
      ...current,
      fullName: current.fullName || authUser.displayName?.trim() || '',
    }));
  }, [authUser, driverProfileMissing]);

  useEffect(() => {
    if (activeOrder) {
      setSelectedTab('trip');
    }
  }, [activeOrder]);

  useEffect(() => {
    if (!authUser?.uid || !hasReadyDriverProfile) {
      return;
    }

    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    const pushLocation = async (coords: Location.LocationObjectCoords) => {
      const heading = typeof coords.heading === 'number' && coords.heading >= 0 ? coords.heading : undefined;
      const speedKph = typeof coords.speed === 'number' && coords.speed >= 0 ? coords.speed * 3.6 : undefined;
      const accuracyMeters = typeof coords.accuracy === 'number' ? coords.accuracy : undefined;

      await updateDriverLocation(authUser.uid, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        heading,
        speedKph,
        accuracyMeters,
      });

      if (!active) {
        return;
      }

      setLocationLabel(
        `Live location synced ${new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })}`
      );
    };

    const startLocationSync = async () => {
      setLocationPermission('requesting');

      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (!active) {
          return;
        }

        if (permission.status !== 'granted') {
          await recordDriverAppOpen({
            uid: authUser.uid,
            email: authUser.email?.trim().toLowerCase(),
            fullName: driverProfile?.fullName || authUser.displayName?.trim() || 'DoorDrive driver',
            phoneNumber: driverProfile?.phoneNumber || '',
          });
          setLocationPermission('denied');
          setLocationLabel('Location permission is required for live driver tracking.');
          return;
        }

        setLocationPermission('granted');

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        await recordDriverAppOpen({
          uid: authUser.uid,
          email: authUser.email?.trim().toLowerCase(),
          fullName: driverProfile?.fullName || authUser.displayName?.trim() || 'DoorDrive driver',
          phoneNumber: driverProfile?.phoneNumber || '',
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
        await pushLocation(current.coords);

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 20,
            timeInterval: 8000,
            mayShowUserSettingsDialog: true,
          },
          (nextLocation) => {
            void pushLocation(nextLocation.coords).catch(() => null);
          }
        );
      } catch {
        if (!active) {
          return;
        }

        setLocationPermission('denied');
        setLocationLabel('Live location could not be started right now.');
      }
    };

    void startLocationSync();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [
    authUser?.displayName,
    authUser?.email,
    authUser?.uid,
    driverProfile?.fullName,
    driverProfile?.phoneNumber,
    hasReadyDriverProfile,
  ]);

  const handleSignIn = async () => {
    if (!loginEmail.trim() || loginPassword.trim().length < 6 || signingIn) {
      return;
    }

    setSigningIn(true);
    setFeedback(null);

    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim().toLowerCase(), loginPassword);
      setFeedback({ tone: 'success', message: 'Signed in to DoorDrive.' });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof FirebaseError
            ? getFirebaseAuthErrorMessage(error.code)
            : 'Unable to sign in right now. Please try again.',
      });
    } finally {
      setSigningIn(false);
    }
  };

  const handleRegister = async () => {
    const normalizedEmail = registerForm.email.trim().toLowerCase();
    const passwordMatches =
      registerForm.password.trim().length >= 6 && registerForm.password.trim() === registerForm.confirmPassword.trim();

    if (
      registering ||
      registerForm.fullName.trim().length < 2 ||
      !/\S+@\S+\.\S+/.test(normalizedEmail) ||
      !normalizedRegisterPhone ||
      !passwordMatches ||
      !registerForm.vehicleLabel.trim() ||
      !registerForm.plateNumber.trim()
    ) {
      setFeedback({
        tone: 'error',
        message: 'Complete every driver registration field before creating the account.',
      });
      return;
    }

    setRegistering(true);
    setFeedback(null);

    try {
      const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, registerForm.password.trim());
      const fullName = registerForm.fullName.trim();

      await updateProfile(credential.user, {
        displayName: fullName,
      });

      await registerDriver({
        uid: credential.user.uid,
        email: normalizedEmail,
        fullName,
        phoneNumber: normalizedRegisterPhone,
        vehicleType: registerForm.vehicleType,
        vehicleLabel: registerForm.vehicleLabel.trim(),
        vehicleColor: registerForm.vehicleColor.trim(),
        plateNumber: registerForm.plateNumber.trim(),
      });

      setRegisterForm(getInitialRegisterForm());
      setFeedback({ tone: 'success', message: 'Driver account created. You can start accepting deliveries now.' });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof FirebaseError
            ? getFirebaseAuthErrorMessage(error.code)
            : 'Unable to register the driver account right now.',
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleCompleteProfile = async () => {
    if (!authUser || !normalizedSetupPhone || !profileSetup.fullName.trim() || !profileSetup.vehicleLabel.trim() || !profileSetup.plateNumber.trim()) {
      setFeedback({ tone: 'error', message: 'Finish the driver profile before continuing.' });
      return;
    }

    setBusyAction('complete-profile');
    setFeedback(null);

    try {
      await registerDriver({
        uid: authUser.uid,
        email: authUser.email?.trim().toLowerCase(),
        fullName: profileSetup.fullName.trim(),
        phoneNumber: normalizedSetupPhone,
        vehicleType: profileSetup.vehicleType,
        vehicleLabel: profileSetup.vehicleLabel.trim(),
        vehicleColor: profileSetup.vehicleColor.trim(),
        plateNumber: profileSetup.plateNumber.trim(),
      });
      setFeedback({ tone: 'success', message: 'Driver profile saved successfully.' });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof FirebaseError
            ? getFirebaseDataErrorMessage(error.code, 'Could not save the driver profile right now.')
            : 'Could not save the driver profile right now.',
      });
    } finally {
      setBusyAction('');
    }
  };

  const handleAdvanceTrip = async (nextStatus: DeliveryOrderStatus) => {
    if (!authUser || !activeOrder || busyAction) {
      return;
    }

    setBusyAction(`trip-${nextStatus}`);
    setFeedback(null);

    try {
      await updateDriverOrderStatus(authUser.uid, activeOrder.id, nextStatus);
      setFeedback({
        tone: 'success',
        message:
          nextStatus === 'delivered'
            ? 'Delivery completed. You are available for the next order.'
            : `Trip updated to ${getDeliveryOrderStatusLabel(nextStatus).toLowerCase()}.`,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof FirebaseError
            ? getFirebaseDataErrorMessage(error.code, 'Could not update the trip status right now.')
            : error instanceof Error
              ? error.message
              : 'Could not update the trip status right now.',
      });
    } finally {
      setBusyAction('');
    }
  };

  const handleToggleAvailability = async () => {
    if (!authUser || !driverProfile || activeOrder || busyAction) {
      return;
    }

    setBusyAction('availability');
    setFeedback(null);

    try {
      await setDriverAvailability(authUser.uid, !driverProfile.isAvailable);
      setFeedback({
        tone: 'success',
        message: !driverProfile.isAvailable ? 'You are now visible to dispatch for assignment.' : 'You are now paused from dispatch assignment.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof FirebaseError
            ? getFirebaseDataErrorMessage(error.code, 'Could not update availability right now.')
            : 'Could not update availability right now.',
      });
    } finally {
      setBusyAction('');
    }
  };

  const handleManualLocationRefresh = async () => {
    if (!authUser || !driverProfile || busyAction) {
      return;
    }

    setBusyAction('location-refresh');
    setFeedback(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationPermission('denied');
        setLocationLabel('Location permission is still denied.');
        return;
      }

      setLocationPermission('granted');
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      await updateDriverLocation(authUser.uid, {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        heading:
          typeof current.coords.heading === 'number' && current.coords.heading >= 0
            ? current.coords.heading
            : undefined,
        speedKph:
          typeof current.coords.speed === 'number' && current.coords.speed >= 0
            ? current.coords.speed * 3.6
            : undefined,
        accuracyMeters: current.coords.accuracy ?? undefined,
      });
      setLocationLabel(
        `Location refreshed ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
      );
    } catch {
      setFeedback({ tone: 'error', message: 'Could not refresh live location right now.' });
    } finally {
      setBusyAction('');
    }
  };

  const handleCallCustomer = async () => {
    if (!activeOrder?.customerPhone) {
      setFeedback({ tone: 'info', message: 'Customer phone number is not available for this order yet.' });
      return;
    }

    const sanitized = activeOrder.customerPhone.replace(/\s+/g, '');
    const target = `tel:${sanitized}`;
    const supported = await Linking.canOpenURL(target);

    if (!supported) {
      Alert.alert('Call unavailable', `This device cannot call ${activeOrder.customerPhone}.`);
      return;
    }

    await Linking.openURL(target);
  };

  const handleOpenNavigation = async () => {
    if (!activeOrder) {
      return;
    }

    const targetLatitude = activeOrder.status === 'driver_assigned' || activeOrder.status === 'driver_at_pickup'
      ? activeOrder.pickupLatitude
      : activeOrder.dropoffLatitude;
    const targetLongitude = activeOrder.status === 'driver_assigned' || activeOrder.status === 'driver_at_pickup'
      ? activeOrder.pickupLongitude
      : activeOrder.dropoffLongitude;
    const targetLabel = activeOrder.status === 'driver_assigned' || activeOrder.status === 'driver_at_pickup'
      ? activeOrder.pickupLabel
      : activeOrder.dropoffLabel;

    if (targetLatitude === undefined || targetLongitude === undefined) {
      setFeedback({ tone: 'info', message: 'This order does not have map coordinates yet.' });
      return;
    }

    const navigationUrl =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${targetLatitude},${targetLongitude}&dirflg=d`
        : `google.navigation:q=${targetLatitude},${targetLongitude}`;
    const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${targetLatitude},${targetLongitude}`;
    const canOpenPrimary = await Linking.canOpenURL(navigationUrl);

    if (canOpenPrimary) {
      await Linking.openURL(navigationUrl);
      return;
    }

    const canOpenFallback = await Linking.canOpenURL(fallbackUrl);
    if (canOpenFallback) {
      await Linking.openURL(fallbackUrl);
      return;
    }

    setFeedback({
      tone: 'info',
      message: `Navigation could not be opened automatically for ${targetLabel || 'this stop'}.`,
    });
  };

  const handleSignOut = async () => {
    if (busyAction) {
      return;
    }

    setBusyAction('sign-out');

    try {
      await signOut(auth);
      setSelectedTab('orders');
      setFeedback({ tone: 'info', message: 'Signed out from DoorDrive.' });
    } catch {
      setFeedback({ tone: 'error', message: 'Could not sign out right now.' });
    } finally {
      setBusyAction('');
    }
  };

  const renderAuthScreen = () => {
    const registerEmailValid = /\S+@\S+\.\S+/.test(registerForm.email.trim());
    const registerPasswordsMatch =
      registerForm.password.trim().length >= 6 &&
      registerForm.password.trim() === registerForm.confirmPassword.trim();

    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.authHeroShell}>
            <View style={styles.authGlowPrimary} />
            <View style={styles.authGlowSecondary} />
            <View style={styles.heroCard}>
              <Text style={styles.heroKicker}>DoorDrive</Text>
              <Text style={styles.heroTitle}>Dispatch-grade driver operations for every trip</Text>
              <Text style={styles.heroText}>
                Sign in, go online for dispatch, follow route guidance, and keep customers updated with live location from one polished driver workspace.
              </Text>
              <View style={styles.authShowcaseRow}>
                <View style={styles.authShowcaseCard}>
                  <Text style={styles.authShowcaseValue}>Live</Text>
                  <Text style={styles.authShowcaseLabel}>dispatch sync</Text>
                </View>
                <View style={styles.authShowcaseCard}>
                  <Text style={styles.authShowcaseValue}>Map</Text>
                  <Text style={styles.authShowcaseLabel}>trip guidance</Text>
                </View>
                <View style={styles.authShowcaseCard}>
                  <Text style={styles.authShowcaseValue}>Online</Text>
                  <Text style={styles.authShowcaseLabel}>driver presence</Text>
                </View>
              </View>
            </View>
          </View>

          {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}

          <View style={styles.card}>
            <View style={styles.authModeRow}>
              <Pressable
                onPress={() => setAuthMode('signin')}
                style={[styles.authModeChip, authMode === 'signin' && styles.authModeChipActive]}>
                <Text style={[styles.authModeText, authMode === 'signin' && styles.authModeTextActive]}>Sign in</Text>
              </Pressable>
              <Pressable
                onPress={() => setAuthMode('register')}
                style={[styles.authModeChip, authMode === 'register' && styles.authModeChipActive]}>
                <Text style={[styles.authModeText, authMode === 'register' && styles.authModeTextActive]}>Register</Text>
              </Pressable>
            </View>

            {authMode === 'signin' ? (
              <View style={styles.stackLg}>
                <Field
                  label="Email address"
                  value={loginEmail}
                  onChangeText={setLoginEmail}
                  placeholder="driver@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Field
                  label="Password"
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  placeholder="Enter your password"
                  secureTextEntry
                  autoCapitalize="none"
                />
                <AppButton
                  label={signingIn ? 'Signing in...' : 'Sign in to drive'}
                  icon="arrow-right"
                  onPress={() => void handleSignIn()}
                  disabled={signingIn}
                />
              </View>
            ) : (
              <View style={styles.stackLg}>
                <Field
                  label="Full name"
                  value={registerForm.fullName}
                  onChangeText={(value) => setRegisterForm((current) => ({ ...current, fullName: value }))}
                  placeholder="Enter your full name"
                />
                <Field
                  label="Email address"
                  value={registerForm.email}
                  onChangeText={(value) => setRegisterForm((current) => ({ ...current, email: value }))}
                  placeholder="driver@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Field
                  label="Phone number"
                  value={registerForm.phoneNumber}
                  onChangeText={(value) => setRegisterForm((current) => ({ ...current, phoneNumber: value }))}
                  placeholder="+255 742 000 111"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Vehicle type</Text>
                  <VehicleTypePicker
                    value={registerForm.vehicleType}
                    onChange={(vehicleType) => setRegisterForm((current) => ({ ...current, vehicleType }))}
                  />
                </View>
                <Field
                  label="Vehicle label"
                  value={registerForm.vehicleLabel}
                  onChangeText={(value) => setRegisterForm((current) => ({ ...current, vehicleLabel: value }))}
                  placeholder="Toyota Probox, motorbike courier, cargo van..."
                />
                <Field
                  label="Vehicle color"
                  value={registerForm.vehicleColor}
                  onChangeText={(value) => setRegisterForm((current) => ({ ...current, vehicleColor: value }))}
                  placeholder="White"
                />
                <Field
                  label="Plate number"
                  value={registerForm.plateNumber}
                  onChangeText={(value) => setRegisterForm((current) => ({ ...current, plateNumber: value }))}
                  placeholder="T 542 DDX"
                  autoCapitalize="characters"
                />
                <Field
                  label="Password"
                  value={registerForm.password}
                  onChangeText={(value) => setRegisterForm((current) => ({ ...current, password: value }))}
                  placeholder="Create a password"
                  secureTextEntry
                  autoCapitalize="none"
                />
                <Field
                  label="Confirm password"
                  value={registerForm.confirmPassword}
                  onChangeText={(value) => setRegisterForm((current) => ({ ...current, confirmPassword: value }))}
                  placeholder="Repeat your password"
                  secureTextEntry
                  autoCapitalize="none"
                />

                <View style={styles.helperCard}>
                  <Text style={styles.helperText}>
                    {!registerEmailValid
                      ? 'Use a valid email address for the driver account.'
                      : !normalizedRegisterPhone
                        ? 'Use a valid phone number, for example +255 742 000 111.'
                        : !registerPasswordsMatch
                          ? 'Passwords must match and be at least 6 characters long.'
                          : 'Everything looks ready. Create the driver account to continue.'}
                  </Text>
                </View>

                <AppButton
                  label={registering ? 'Creating driver account...' : 'Create driver account'}
                  icon="account-plus-outline"
                  onPress={() => void handleRegister()}
                  disabled={registering}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  const renderProfileSetup = () => (
    <ScrollView contentContainerStyle={styles.dashboardContent} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <Text style={styles.heroKicker}>Complete profile</Text>
        <Text style={styles.heroTitle}>Finish your driver setup before going online</Text>
        <Text style={styles.heroText}>
          DoorDrive needs your phone number, registered vehicle, and plate number before you can accept jobs.
        </Text>
      </View>

      {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}

      <SectionCard title="Driver identity" subtitle="These details are stored in the shared Firebase project.">
        <View style={styles.stackLg}>
          <Field
            label="Full name"
            value={profileSetup.fullName}
            onChangeText={(value) => setProfileSetup((current) => ({ ...current, fullName: value }))}
            placeholder="Enter your full name"
          />
          <Field
            label="Phone number"
            value={profileSetup.phoneNumber}
            onChangeText={(value) => setProfileSetup((current) => ({ ...current, phoneNumber: value }))}
            placeholder="+255 742 000 111"
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Vehicle type</Text>
            <VehicleTypePicker
              value={profileSetup.vehicleType}
              onChange={(vehicleType) => setProfileSetup((current) => ({ ...current, vehicleType }))}
            />
          </View>
          <Field
            label="Vehicle label"
            value={profileSetup.vehicleLabel}
            onChangeText={(value) => setProfileSetup((current) => ({ ...current, vehicleLabel: value }))}
            placeholder="Toyota Probox, motorbike courier, cargo van..."
          />
          <Field
            label="Vehicle color"
            value={profileSetup.vehicleColor}
            onChangeText={(value) => setProfileSetup((current) => ({ ...current, vehicleColor: value }))}
            placeholder="White"
          />
          <Field
            label="Plate number"
            value={profileSetup.plateNumber}
            onChangeText={(value) => setProfileSetup((current) => ({ ...current, plateNumber: value }))}
            placeholder="T 542 DDX"
            autoCapitalize="characters"
          />
          <AppButton
            label={busyAction === 'complete-profile' ? 'Saving profile...' : 'Save driver profile'}
            icon="content-save-outline"
            onPress={() => void handleCompleteProfile()}
            disabled={busyAction === 'complete-profile'}
          />
        </View>
      </SectionCard>
    </ScrollView>
  );

  const renderOrdersTab = () => (
    <ScrollView contentContainerStyle={styles.dashboardContent} showsVerticalScrollIndicator={false}>
      {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}

      <View style={styles.heroCard}>
        <Text style={styles.heroKicker}>Driver console</Text>
        <Text style={styles.heroTitle}>{driverProfile?.fullName || 'Driver'} is ready to drive</Text>
        <Text style={styles.heroText}>
          Stay available for dispatch, keep your live location in sync, and wait for admin to assign your next delivery.
        </Text>
        <View style={styles.pillRow}>
          <View
            style={[
              styles.infoPill,
              activeOrder ? styles.infoPillInfo : driverProfile?.isAvailable ? styles.infoPillSuccess : styles.infoPillMuted,
            ]}>
            <MaterialCommunityIcons
              name={activeOrder ? 'truck-delivery-outline' : driverProfile?.isAvailable ? 'check-circle-outline' : 'pause-circle-outline'}
              size={16}
              color={
                activeOrder
                  ? driveTheme.colors.info
                  : driverProfile?.isAvailable
                    ? driveTheme.colors.primaryDark
                    : driveTheme.colors.subtext
              }
            />
            <Text
              style={[
                styles.infoPillText,
                activeOrder ? styles.infoPillTextInfo : driverProfile?.isAvailable ? styles.infoPillTextSuccess : null,
              ]}>
              {availabilityLabel}
            </Text>
          </View>
          <View style={[styles.infoPill, locationPermission === 'granted' ? styles.infoPillInfo : styles.infoPillMuted]}>
            <MaterialCommunityIcons
              name={locationPermission === 'granted' ? 'crosshairs-gps' : 'map-marker-off-outline'}
              size={16}
              color={locationPermission === 'granted' ? driveTheme.colors.info : driveTheme.colors.subtext}
            />
            <Text style={styles.infoPillText}>{locationPermission === 'granted' ? 'Live location on' : 'Location pending'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.metricTileRow}>
        <MetricTile
          icon="truck-delivery-outline"
          value={activeOrder ? '1' : '0'}
          label={activeOrder ? 'active trip' : 'active trips'}
        />
        <MetricTile
          icon="check-decagram-outline"
          value={String(recentOrders.filter((order) => order.status === 'delivered').length)}
          label="completed"
        />
        <MetricTile
          icon={locationPermission === 'granted' ? 'crosshairs-gps' : 'map-marker-off-outline'}
          value={locationPermission === 'granted' ? 'Live' : 'Off'}
          label="location"
        />
      </View>

      <SectionCard title="Online or offline" subtitle={availabilityNote}>
        <View style={styles.stackMd}>
          <View style={[styles.statusCard, activeOrder ? styles.statusCardInfo : driverProfile?.isAvailable ? styles.statusCardOnline : styles.statusCardOffline]}>
            <View style={styles.statusCardTop}>
              <View>
                <Text style={styles.statusCardTitle}>{availabilityLabel}</Text>
                <Text style={styles.statusCardText}>{availabilityNote}</Text>
              </View>
              <MaterialCommunityIcons
                name={activeOrder ? 'truck-delivery-outline' : driverProfile?.isAvailable ? 'toggle-switch' : 'toggle-switch-off-outline'}
                size={30}
                color={activeOrder ? driveTheme.colors.info : driverProfile?.isAvailable ? driveTheme.colors.primaryDark : driveTheme.colors.subtext}
              />
            </View>
            <AppButton
              label={
                busyAction === 'availability'
                  ? 'Updating availability...'
                  : activeOrder
                    ? 'Online during active trip'
                    : driverProfile?.isAvailable
                      ? 'Go offline'
                      : 'Go online'
              }
              icon={driverProfile?.isAvailable ? 'pause-circle-outline' : 'check-circle-outline'}
              variant="secondary"
              onPress={() => void handleToggleAvailability()}
              disabled={!!activeOrder || busyAction === 'availability'}
            />
          </View>
        </View>
      </SectionCard>

      <SectionCard
        title="Dispatch feed"
        subtitle={
          activeOrder
            ? 'Finish your active job before you can receive another assignment.'
            : 'Orders appear here only after DoorDrop dispatch assigns them to you.'
        }>
        <View style={styles.stackLg}>
          {driverOrdersLoading ? <ActivityIndicator color={driveTheme.colors.primary} /> : null}

          {!driverOrdersLoading && !driverOrders.length ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="clipboard-text-clock-outline" size={28} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No dispatch assignment yet</Text>
              <Text style={styles.emptyText}>Stay active in DoorDrive and the admin team will assign work from the dispatch website.</Text>
            </View>
          ) : null}

          {driverOrders.map((order) => {
            const pickupDistanceLabel =
              driverProfile?.currentLatitude !== undefined &&
              driverProfile.currentLongitude !== undefined &&
              order.pickupLatitude !== undefined &&
              order.pickupLongitude !== undefined
                ? formatDistanceKm(
                    haversineDistanceKm(
                      {
                        latitude: driverProfile.currentLatitude,
                        longitude: driverProfile.currentLongitude,
                      },
                      {
                        latitude: order.pickupLatitude,
                        longitude: order.pickupLongitude,
                      }
                    )
                  )
                : null;
            const isAssignedToDriver = order.driverId === authUser?.uid;

            return (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderTop}>
                  <View style={styles.orderIconWrap}>
                    <MaterialCommunityIcons
                      name={order.serviceLabel.toLowerCase().includes('parcel') ? 'package-variant-closed' : 'truck-fast-outline'}
                      size={20}
                      color={driveTheme.colors.primaryDark}
                    />
                  </View>
                  <View style={styles.orderCopy}>
                    <Text style={styles.orderTitle}>{order.serviceLabel}</Text>
                    <Text style={styles.orderMeta}>
                      {order.orderNumber} • {formatDeliveryDateTime(order.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.orderPriceWrap}>
                    <Text style={styles.orderPrice}>{order.totalLabel}</Text>
                  </View>
                </View>

                <Text style={styles.orderRoute}>{order.pickupLabel}</Text>
                <Text style={styles.orderRoute}>{order.dropoffLabel}</Text>
                <Text style={styles.orderDetail}>Customer: {order.customerName} • {order.customerPhone || order.customerEmail}</Text>
                <Text style={styles.orderDetail}>Recipient: {order.recipientName} • {order.recipientPhone}</Text>
                <Text style={styles.orderDetail}>Schedule: {order.scheduleLabel} • ETA {order.etaLabel}</Text>
                <Text style={styles.orderDetail}>Dispatch status: {getDeliveryOrderStatusLabel(order.status)}</Text>
                {pickupDistanceLabel ? <Text style={styles.orderHint}>Pickup is {pickupDistanceLabel} from your live location.</Text> : null}

                {isAssignedToDriver && isActiveOrderStatus(order.status) ? (
                  <View style={styles.infoCallout}>
                    <MaterialCommunityIcons name="account-check-outline" size={18} color={driveTheme.colors.primaryDark} />
                    <Text style={styles.infoCalloutText}>Assigned by DoorDrop dispatch. Open the Trip tab to continue this job.</Text>
                  </View>
                ) : (
                  <View style={styles.infoCalloutMuted}>
                    <MaterialCommunityIcons name="history" size={18} color={driveTheme.colors.subtext} />
                    <Text style={styles.infoCalloutTextMuted}>This trip is stored in your driver history. New assignments come only from dispatch.</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard title="Recent deliveries" subtitle="Orders already assigned to this driver account.">
        <View style={styles.stackMd}>
          {!driverOrdersLoading && !recentOrders.length ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No delivery history yet</Text>
              <Text style={styles.emptyText}>Trips assigned by dispatch will appear here after you complete your first job.</Text>
            </View>
          ) : null}

          {recentOrders.map((order) => (
            <View key={order.id} style={styles.historyRow}>
              <View>
                <Text style={styles.historyTitle}>{order.serviceLabel}</Text>
                <Text style={styles.historyMeta}>{order.pickupLabel} to {order.dropoffLabel}</Text>
              </View>
              <View style={styles.historyTrailing}>
                <Text style={styles.historyAmount}>{order.totalLabel}</Text>
                <Text style={styles.historyStatus}>{getDeliveryOrderStatusLabel(order.status)}</Text>
              </View>
            </View>
          ))}
        </View>
      </SectionCard>
    </ScrollView>
  );

  const renderTripTab = () => {
    const nextAction = getNextTripAction(activeOrder?.status);
    const pickupPoint =
      activeOrder?.pickupLatitude !== undefined && activeOrder.pickupLongitude !== undefined
        ? {
            latitude: activeOrder.pickupLatitude,
            longitude: activeOrder.pickupLongitude,
          }
        : {
            latitude: -6.7924,
            longitude: 39.2083,
          };
    const dropoffPoint =
      activeOrder?.dropoffLatitude !== undefined && activeOrder.dropoffLongitude !== undefined
        ? {
            latitude: activeOrder.dropoffLatitude,
            longitude: activeOrder.dropoffLongitude,
          }
        : getFallbackDropoffPoint(pickupPoint);
    const driverPoint =
      activeOrder?.driverLatitude !== undefined && activeOrder.driverLongitude !== undefined
        ? {
            latitude: activeOrder.driverLatitude,
            longitude: activeOrder.driverLongitude,
          }
        : activeOrder
          ? interpolatePoint(
              pickupPoint,
              dropoffPoint,
              activeOrder.status === 'driver_assigned'
                ? 0.08
                : activeOrder.status === 'driver_at_pickup'
                  ? 0.02
                  : activeOrder.status === 'in_transit'
                    ? 0.56
                    : 0.98
            )
          : null;

    return (
      <ScrollView contentContainerStyle={styles.tripScreenContent} showsVerticalScrollIndicator={false}>
        {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}

        {!activeOrder ? (
          <View style={styles.emptyStateLarge}>
            <MaterialCommunityIcons name="map-marker-path" size={34} color={driveTheme.colors.primary} />
            <Text style={styles.emptyTitle}>No active trip right now</Text>
            <Text style={styles.emptyText}>Wait for dispatch to assign an order and your live trip controls will appear here.</Text>
          </View>
        ) : (
          <>
            <View style={styles.tripMapStage}>
              <TripMap
                pickupPoint={pickupPoint}
                dropoffPoint={dropoffPoint}
                driverPoint={driverPoint}
                statusLabel={getDeliveryOrderStatusLabel(activeOrder.status)}
                onOpenNavigation={() => void handleOpenNavigation()}
              />
            </View>

            <View style={styles.tripBottomSheet}>
              <View style={styles.tripSheetHandle} />
              <View style={styles.tripHero}>
                <Text style={styles.heroKicker}>Active delivery</Text>
                <Text style={styles.tripHeroTitle}>{activeOrder.serviceLabel}</Text>
                <Text style={styles.tripHeroText}>{getDeliveryOrderStatusLabel(activeOrder.status)}</Text>
                <View style={styles.tripMetricRow}>
                  <TripMetricChip icon="pound" label={activeOrder.orderNumber} />
                  <TripMetricChip icon="cash-multiple" label={activeOrder.totalLabel} />
                  <TripMetricChip
                    icon={locationPermission === 'granted' ? 'crosshairs-gps' : 'map-marker-off-outline'}
                    label={locationPermission === 'granted' ? 'Location live' : 'Location pending'}
                  />
                </View>
              </View>

              <View style={styles.tripSheetCard}>
                <Text style={styles.tripSheetTitle}>Trip route</Text>
                <Text style={styles.tripSheetSubtitle}>Navigation stops for this active job.</Text>
                <View style={styles.stackMd}>
                  <TripStopRow tone="pickup" title="Pickup" label={activeOrder.pickupLabel} />
                  <TripStopRow tone="dropoff" title="Drop-off" label={activeOrder.dropoffLabel} />
                  <View style={styles.tripDivider} />
                  <Text style={styles.tripLine}>Recipient: {activeOrder.recipientName} • {activeOrder.recipientPhone}</Text>
                  <Text style={styles.tripLine}>Customer: {activeOrder.customerName} • {activeOrder.customerPhone || activeOrder.customerEmail}</Text>
                  <Text style={styles.tripLine}>Created: {formatDeliveryDateTime(activeOrder.createdAt)}</Text>
                </View>
              </View>

              <View style={styles.tripActionSheet}>
                {nextAction ? (
                  <AppButton
                    label={busyAction === `trip-${nextAction.nextStatus}` ? `${nextAction.label}...` : nextAction.label}
                    icon={nextAction.icon}
                    onPress={() => void handleAdvanceTrip(nextAction.nextStatus)}
                    disabled={busyAction === `trip-${nextAction.nextStatus}`}
                  />
                ) : null}
                <View style={styles.tripActionGrid}>
                  <AppButton
                    label="Open navigation"
                    icon="navigation-variant-outline"
                    variant="secondary"
                    onPress={() => void handleOpenNavigation()}
                  />
                  <AppButton
                    label="Call customer"
                    icon="phone-outline"
                    variant="secondary"
                    onPress={() => void handleCallCustomer()}
                  />
                </View>
                <View style={styles.tripActionGrid}>
                  <AppButton
                    label={busyAction === 'location-refresh' ? 'Refreshing location...' : 'Refresh live location'}
                    icon="crosshairs-gps"
                    variant="secondary"
                    onPress={() => void handleManualLocationRefresh()}
                    disabled={busyAction === 'location-refresh'}
                  />
                  <AppButton
                    label={busyAction === 'trip-cancelled' ? 'Cancelling...' : 'Cancel order'}
                    icon="close-circle-outline"
                    variant="dark"
                    onPress={() => void handleAdvanceTrip('cancelled')}
                    disabled={busyAction === 'trip-cancelled'}
                  />
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    );
  };

  const renderAccountTab = () => (
    <ScrollView contentContainerStyle={styles.dashboardContent} showsVerticalScrollIndicator={false}>
      {feedback ? <FeedbackBanner tone={feedback.tone} message={feedback.message} /> : null}

      <View style={styles.heroCard}>
        <Text style={styles.heroKicker}>Driver account</Text>
        <Text style={styles.heroTitle}>{driverProfile?.fullName || authUser?.displayName || 'DoorDrive driver'}</Text>
        <Text style={styles.heroText}>
          {driverProfile?.vehicleLabel || 'Vehicle pending'} • {driverProfile?.plateNumber || 'Plate pending'}
        </Text>
      </View>

      <View style={styles.metricTileRow}>
        <MetricTile
          icon={driverProfile?.isAvailable ? 'check-circle-outline' : 'pause-circle-outline'}
          value={driverProfile?.isAvailable ? 'Online' : 'Offline'}
          label="dispatch"
        />
        <MetricTile
          icon="history"
          value={String(driverOrders.length)}
          label="total jobs"
        />
        <MetricTile
          icon="license"
          value={driverProfile?.plateNumber || 'Pending'}
          label="plate"
        />
      </View>

      <SectionCard title="Driver profile" subtitle="These details are synced from Firebase.">
        <View style={styles.stackMd}>
          <Text style={styles.tripLine}>Email: {authUser?.email || driverProfile?.email || 'Not available'}</Text>
          <Text style={styles.tripLine}>Phone: {driverProfile?.phoneNumber || 'Not available'}</Text>
          <Text style={styles.tripLine}>Vehicle type: {driverProfile?.vehicleType || 'Not set'}</Text>
          <Text style={styles.tripLine}>Vehicle label: {driverProfile?.vehicleLabel || 'Not set'}</Text>
          <Text style={styles.tripLine}>Vehicle color: {driverProfile?.vehicleColor || 'Not set'}</Text>
          <Text style={styles.tripLine}>Plate number: {driverProfile?.plateNumber || 'Not set'}</Text>
        </View>
      </SectionCard>

      <SectionCard title="Availability and tracking" subtitle="Your live location is used for customer tracking while you drive.">
        <View style={styles.stackMd}>
          <Text style={styles.tripLine}>Availability: {availabilityLabel}</Text>
          <Text style={styles.tripLine}>Location permission: {locationPermission}</Text>
          <Text style={styles.tripLine}>{locationLabel}</Text>
          {driverProfile?.lastLocationUpdatedAt ? (
            <Text style={styles.tripLine}>Last location write: {formatDeliveryDateTime(driverProfile.lastLocationUpdatedAt)}</Text>
          ) : null}
          <AppButton
            label={busyAction === 'availability' ? 'Updating availability...' : driverProfile?.isAvailable ? 'Pause dispatch visibility' : 'Go visible to dispatch'}
            icon={driverProfile?.isAvailable ? 'pause-circle-outline' : 'check-circle-outline'}
            variant="secondary"
            onPress={() => void handleToggleAvailability()}
            disabled={!!activeOrder || busyAction === 'availability'}
          />
          <AppButton
            label={busyAction === 'location-refresh' ? 'Refreshing location...' : 'Refresh live location'}
            icon="crosshairs-gps"
            variant="secondary"
            onPress={() => void handleManualLocationRefresh()}
            disabled={busyAction === 'location-refresh'}
          />
          <AppButton
            label={busyAction === 'sign-out' ? 'Signing out...' : 'Sign out'}
            icon="logout"
            variant="dark"
            onPress={() => void handleSignOut()}
            disabled={busyAction === 'sign-out'}
          />
        </View>
      </SectionCard>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      {authInitializing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={driveTheme.colors.primary} />
          <Text style={styles.loadingText}>Connecting DoorDrive to Firebase...</Text>
        </View>
      ) : !authUser ? (
        renderAuthScreen()
      ) : driverProfileMissing ? (
        renderProfileSetup()
      ) : (
        <View style={styles.flex}>
          {selectedTab === 'orders' ? renderOrdersTab() : null}
          {selectedTab === 'trip' ? renderTripTab() : null}
          {selectedTab === 'account' ? renderAccountTab() : null}

          <View style={styles.bottomNav}>
            {tabs.map((tab) => {
              const active = selectedTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setSelectedTab(tab.key)}
                  style={[styles.bottomNavItem, active && styles.bottomNavItemActive]}>
                  <MaterialCommunityIcons
                    name={tab.icon}
                    size={22}
                    color={active ? driveTheme.colors.primaryDark : '#94A3B8'}
                  />
                  <Text style={[styles.bottomNavLabel, active && styles.bottomNavLabelActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: driveTheme.colors.canvas,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 24,
  },
  loadingText: {
    color: driveTheme.colors.subtext,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  authScroll: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 18,
  },
  authHeroShell: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: driveTheme.radius.xl,
  },
  authGlowPrimary: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: 'rgba(134, 239, 172, 0.14)',
    top: -40,
    right: -30,
    zIndex: 1,
  },
  authGlowSecondary: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    bottom: -30,
    left: -20,
    zIndex: 1,
  },
  dashboardContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 110,
    gap: 18,
  },
  tripScreenContent: {
    paddingBottom: 110,
    gap: 0,
  },
  heroCard: {
    borderRadius: driveTheme.radius.xl,
    padding: 22,
    backgroundColor: driveTheme.colors.dark,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 30,
    elevation: 6,
  },
  heroKicker: {
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    marginBottom: 10,
  },
  heroText: {
    color: '#D7E1EA',
    fontSize: 14,
    lineHeight: 22,
  },
  authShowcaseRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  authShowcaseCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    gap: 4,
  },
  authShowcaseValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  authShowcaseLabel: {
    color: '#C9D6E2',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  tripHero: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: driveTheme.colors.dark,
    gap: 10,
  },
  tripHeroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
  },
  tripHeroText: {
    color: '#D7E1EA',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  tripMetricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  tripMetricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: driveTheme.radius.pill,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  tripMetricText: {
    color: driveTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  metricTileRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricTile: {
    flex: 1,
    minHeight: 108,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: driveTheme.colors.line,
    padding: 16,
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 2,
  },
  metricTileIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: driveTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTileValue: {
    color: driveTheme.colors.ink,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  metricTileLabel: {
    color: driveTheme.colors.subtext,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    borderRadius: driveTheme.radius.xl,
    backgroundColor: driveTheme.colors.surface,
    padding: 20,
    borderWidth: 1,
    borderColor: driveTheme.colors.line,
    gap: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 2,
  },
  cardHeader: {
    gap: 6,
  },
  cardTitle: {
    color: driveTheme.colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: driveTheme.colors.subtext,
    fontSize: 13,
    lineHeight: 20,
  },
  authModeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  authModeChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: driveTheme.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  authModeChipActive: {
    backgroundColor: driveTheme.colors.primarySoft,
    borderColor: '#BBF7D0',
  },
  authModeText: {
    color: driveTheme.colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  authModeTextActive: {
    color: driveTheme.colors.primaryDark,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: driveTheme.colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  textInput: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    color: driveTheme.colors.ink,
    fontSize: 15,
  },
  stackLg: {
    gap: 16,
  },
  stackMd: {
    gap: 12,
  },
  helperCard: {
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  helperText: {
    color: driveTheme.colors.subtext,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonBase: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: driveTheme.colors.primary,
    borderColor: driveTheme.colors.primary,
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderColor: driveTheme.colors.line,
  },
  buttonDark: {
    backgroundColor: driveTheme.colors.dark,
    borderColor: driveTheme.colors.dark,
  },
  buttonDisabled: {
    opacity: 0.58,
  },
  buttonPressed: {
    opacity: 0.86,
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonTextSecondary: {
    color: driveTheme.colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  vehiclePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: driveTheme.radius.pill,
    borderWidth: 1,
    borderColor: driveTheme.colors.line,
    backgroundColor: '#FFFFFF',
  },
  vehicleChipActive: {
    backgroundColor: driveTheme.colors.primarySoft,
    borderColor: '#BBF7D0',
  },
  vehicleChipText: {
    color: driveTheme.colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  vehicleChipTextActive: {
    color: driveTheme.colors.primaryDark,
  },
  feedbackBanner: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedbackSuccess: {
    backgroundColor: driveTheme.colors.primarySoft,
  },
  feedbackError: {
    backgroundColor: '#FEE2E2',
  },
  feedbackInfo: {
    backgroundColor: '#EFF6FF',
  },
  feedbackText: {
    color: driveTheme.colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: driveTheme.radius.pill,
  },
  infoPillSuccess: {
    backgroundColor: driveTheme.colors.primarySoft,
  },
  infoPillInfo: {
    backgroundColor: '#DBEAFE',
  },
  infoPillMuted: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  infoPillText: {
    color: '#D7E1EA',
    fontSize: 12,
    fontWeight: '800',
  },
  infoPillTextSuccess: {
    color: driveTheme.colors.primaryDark,
  },
  infoPillTextInfo: {
    color: driveTheme.colors.info,
  },
  statusCard: {
    borderRadius: driveTheme.radius.lg,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  statusCardOnline: {
    backgroundColor: driveTheme.colors.primarySoft,
    borderColor: '#BBF7D0',
  },
  statusCardOffline: {
    backgroundColor: '#F8FAFC',
    borderColor: driveTheme.colors.line,
  },
  statusCardInfo: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  statusCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  statusCardTitle: {
    color: driveTheme.colors.ink,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  statusCardText: {
    color: driveTheme.colors.subtext,
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 250,
  },
  emptyState: {
    borderRadius: driveTheme.radius.lg,
    borderWidth: 1,
    borderColor: driveTheme.colors.line,
    backgroundColor: '#F8FAFC',
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyStateLarge: {
    borderRadius: driveTheme.radius.xl,
    borderWidth: 1,
    borderColor: driveTheme.colors.line,
    backgroundColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyTitle: {
    color: driveTheme.colors.ink,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    color: driveTheme.colors.subtext,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  orderCard: {
    borderRadius: driveTheme.radius.lg,
    borderWidth: 1,
    borderColor: driveTheme.colors.line,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 10,
  },
  orderTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: driveTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  orderCopy: {
    flex: 1,
  },
  orderTitle: {
    color: driveTheme.colors.ink,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  orderMeta: {
    color: driveTheme.colors.subtext,
    fontSize: 12,
    lineHeight: 18,
  },
  orderPriceWrap: {
    marginLeft: 12,
  },
  orderPrice: {
    color: driveTheme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '800',
  },
  orderRoute: {
    color: driveTheme.colors.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  orderDetail: {
    color: driveTheme.colors.subtext,
    fontSize: 12,
    lineHeight: 18,
  },
  orderHint: {
    color: driveTheme.colors.info,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  infoCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 16,
    backgroundColor: driveTheme.colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  infoCalloutMuted: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  infoCalloutText: {
    flex: 1,
    color: driveTheme.colors.primaryDark,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  infoCalloutTextMuted: {
    flex: 1,
    color: driveTheme.colors.subtext,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  mapCard: {
    position: 'relative',
  },
  tripMapStage: {
    paddingHorizontal: 0,
    backgroundColor: driveTheme.colors.dark,
  },
  mapView: {
    width: '100%',
    height: 440,
    borderRadius: 0,
  },
  mapOverlay: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'space-between',
    padding: 18,
  },
  mapOverlayTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  mapOverlayBottom: {
    alignItems: 'flex-end',
  },
  mapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.86)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  mapBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  mapBadgeMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  mapBadgeMutedText: {
    color: driveTheme.colors.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  mapNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: driveTheme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 4,
  },
  mapNavButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  tripBottomSheet: {
    marginTop: -36,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: driveTheme.colors.canvas,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 110,
    gap: 16,
  },
  tripSheetHandle: {
    width: 58,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 2,
  },
  tripSheetCard: {
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: driveTheme.colors.line,
    padding: 18,
    gap: 12,
  },
  tripSheetTitle: {
    color: driveTheme.colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  tripSheetSubtitle: {
    color: driveTheme.colors.subtext,
    fontSize: 13,
    lineHeight: 20,
  },
  tripActionSheet: {
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: driveTheme.colors.line,
    padding: 18,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 3,
  },
  mapFallbackShell: {
    gap: 12,
  },
  mapFallbackScene: {
    height: 440,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#E8F1EC',
  },
  mapFallbackGlowA: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: 'rgba(15, 157, 88, 0.12)',
    top: -30,
    left: -20,
  },
  mapFallbackGlowB: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    bottom: -10,
    right: -10,
  },
  mapRouteLine: {
    position: 'absolute',
    left: 72,
    top: 94,
    width: 180,
    height: 6,
    borderRadius: 999,
    backgroundColor: driveTheme.colors.primary,
    transform: [{ rotate: '28deg' }],
  },
  mapNode: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 4,
  },
  mapNodePickup: {
    top: 82,
    left: 56,
    backgroundColor: '#F97316',
  },
  mapNodeDropoff: {
    right: 54,
    bottom: 64,
    backgroundColor: driveTheme.colors.primary,
  },
  mapNodeDriver: {
    top: 148,
    left: 160,
    backgroundColor: driveTheme.colors.info,
  },
  mapNodeInner: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  mapFallbackCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: driveTheme.colors.line,
    backgroundColor: '#F8FAFC',
    padding: 14,
    gap: 10,
  },
  mapFallbackTitle: {
    color: driveTheme.colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  mapFallbackText: {
    color: driveTheme.colors.subtext,
    fontSize: 12,
    lineHeight: 18,
  },
  tripStopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tripStopDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    marginTop: 4,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  tripStopPickup: {
    backgroundColor: '#F97316',
  },
  tripStopDropoff: {
    backgroundColor: driveTheme.colors.primary,
  },
  tripStopCopy: {
    flex: 1,
    gap: 4,
  },
  tripStopTitle: {
    color: driveTheme.colors.subtext,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '800',
  },
  tripStopLabel: {
    color: driveTheme.colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '800',
  },
  tripDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  tripActionPrimary: {
    gap: 12,
  },
  tripActionGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  historyTitle: {
    color: driveTheme.colors.ink,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  historyMeta: {
    color: driveTheme.colors.subtext,
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 210,
  },
  historyTrailing: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  historyAmount: {
    color: driveTheme.colors.ink,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  historyStatus: {
    color: driveTheme.colors.subtext,
    fontSize: 12,
    fontWeight: '700',
  },
  tripLine: {
    color: driveTheme.colors.ink,
    fontSize: 14,
    lineHeight: 21,
  },
  bottomNav: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    flexDirection: 'row',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: driveTheme.colors.line,
    paddingVertical: 10,
    paddingHorizontal: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 4,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 18,
  },
  bottomNavItemActive: {
    backgroundColor: driveTheme.colors.primarySoft,
  },
  bottomNavLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomNavLabelActive: {
    color: driveTheme.colors.primaryDark,
  },
});
