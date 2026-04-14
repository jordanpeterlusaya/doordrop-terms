import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, type MapPressEvent, PROVIDER_GOOGLE } from 'react-native-maps';

import { CargoHeader, CargoScreen, PrimaryButton, SectionHeader, SummaryRow } from '@/components/cargo-ui';
import { cargoTheme, parcelScopes, type ParcelScope } from '@/constants/cargo-theme';

const cityParcelTypes = [
  {
    key: 'document',
    title: 'Documents',
    subtitle: 'Contracts, IDs and paperwork for fast local delivery',
    icon: 'file-document-outline' as const,
  },
  {
    key: 'food',
    title: 'Food',
    subtitle: 'Meals, bakery items and takeaway orders',
    icon: 'silverware-fork-knife' as const,
  },
  {
    key: 'box',
    title: 'Small box',
    subtitle: 'Gifts, gadgets or daily essentials',
    icon: 'archive-outline' as const,
  },
  {
    key: 'fragile',
    title: 'Fragile item',
    subtitle: 'Handled carefully with added delivery notes',
    icon: 'glass-fragile' as const,
  },
] as const;

const outsideParcelTypes = [
  {
    key: 'luggage',
    title: 'Luggage',
    subtitle: 'Travel bags, suitcases and personal cargo',
    icon: 'bag-suitcase-outline' as const,
  },
  {
    key: 'box-bulk',
    title: 'Boxed goods',
    subtitle: 'Packed goods for regional or intercity delivery',
    icon: 'package-variant-closed' as const,
  },
  {
    key: 'electronics',
    title: 'Electronics',
    subtitle: 'Phones, devices and protected valuables',
    icon: 'laptop' as const,
  },
  {
    key: 'food-bulk',
    title: 'Food package',
    subtitle: 'Sealed groceries or food parcels for longer routes',
    icon: 'food-apple-outline' as const,
  },
] as const;

type ParcelOption = (typeof cityParcelTypes)[number] | (typeof outsideParcelTypes)[number];

const defaultRegion = {
  latitude: -6.7924,
  longitude: 39.2083,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

function formatPickupLabel(address: Location.LocationGeocodedAddress | null, point: { latitude: number; longitude: number }) {
  if (address) {
    const parts = [address.name, address.street, address.district, address.city].filter(Boolean);
    const unique = [...new Set(parts)];
    if (unique.length > 0) {
      return unique.slice(0, 3).join(', ');
    }
  }

  return `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`;
}

export default function SendParcelScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [selectedScope, setSelectedScope] = useState<ParcelScope>('city');
  const [selectedPackage, setSelectedPackage] = useState<ParcelOption['key']>(cityParcelTypes[0].key);
  const [timing, setTiming] = useState<'now' | 'later'>('now');
  const [pickupLabel, setPickupLabel] = useState('Detecting your current location...');
  const [pickupPoint, setPickupPoint] = useState({
    latitude: defaultRegion.latitude,
    longitude: defaultRegion.longitude,
  });
  const [dropoff, setDropoff] = useState('');
  const [dropoffPoint, setDropoffPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  const availablePackages = selectedScope === 'city' ? cityParcelTypes : outsideParcelTypes;
  const activePackage = availablePackages.find((item) => item.key === selectedPackage) ?? availablePackages[0];
  const recipientPhoneDigits = recipientPhone.replace(/\D/g, '');
  const scheduleReady = timing === 'now' || (scheduledDate.trim().length > 0 && scheduledTime.trim().length > 0);
  const isFormValid = dropoff.trim().length >= 4 && recipientName.trim().length >= 2 && recipientPhoneDigits.length >= 9 && scheduleReady;

  const price = selectedScope === 'city' ? 'TZS 6,500' : 'TZS 18,500';
  const eta = timing === 'later' ? 'Scheduled by your selected time' : selectedScope === 'city' ? '15-30 min' : '3-5 hrs';

  useEffect(() => {
    let isMounted = true;

    const loadPickupLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setPickupLabel('Location access is off. Using Dar es Salaam pickup preview.');
          }
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        const point = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        };
        const reverse = await Location.reverseGeocodeAsync(point);

        if (isMounted) {
          setPickupPoint(point);
          setPickupLabel(formatPickupLabel(reverse[0] ?? null, point));
          mapRef.current?.animateToRegion(
            {
              latitude: point.latitude,
              longitude: point.longitude,
              latitudeDelta: defaultRegion.latitudeDelta,
              longitudeDelta: defaultRegion.longitudeDelta,
            },
            700
          );
        }
      } catch {
        if (isMounted) {
          setPickupPoint({
            latitude: defaultRegion.latitude,
            longitude: defaultRegion.longitude,
          });
          setPickupLabel(formatPickupLabel(null, defaultRegion));
        }
      }
    };

    const loadContacts = async () => {
      try {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setContactsLoaded(true);
          }
          return;
        }

        const result = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers],
          pageSize: 1000,
        });

        if (isMounted) {
          setContacts(result.data.filter((contact) => (contact.phoneNumbers?.length ?? 0) > 0));
          setContactsLoaded(true);
        }
      } catch {
        if (isMounted) {
          setContactsLoaded(true);
        }
      }
    };

    loadPickupLocation();
    loadContacts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!availablePackages.some((item) => item.key === selectedPackage)) {
      setSelectedPackage(availablePackages[0].key);
    }
  }, [availablePackages, selectedPackage]);

  const contactPreviewText = useMemo(() => {
    if (!contactsLoaded) {
      return 'Loading contacts for quick recipient selection...';
    }

    if (!contacts.length) {
      return 'No contact shortcuts available. You can still enter recipient details manually.';
    }

    return 'Tap a contact below to autofill the recipient name and phone number.';
  }, [contacts, contactsLoaded]);

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();

    if (!query) {
      return contacts;
    }

    return contacts.filter((contact) => {
      const firstPhone = contact.phoneNumbers?.[0]?.number?.toLowerCase() ?? '';
      const name = contact.name?.toLowerCase() ?? '';
      return name.includes(query) || firstPhone.includes(query);
    });
  }, [contactSearch, contacts]);

  const handleMapPress = async (event: MapPressEvent) => {
    const point = event.nativeEvent.coordinate;
    setDropoffPoint(point);

    try {
      const reverse = await Location.reverseGeocodeAsync(point);
      const address = reverse[0];
      if (address) {
        const parts = [address.name, address.street, address.district, address.city, address.region].filter(Boolean);
        const label = [...new Set(parts)].slice(0, 3).join(', ');
        setDropoff(label || `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`);
        return;
      }
    } catch {
      // Fall back to coordinates if reverse geocoding fails.
    }

    setDropoff(`${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`);
  };

  return (
    <CargoScreen
      contentContainerStyle={styles.content}
      footer={
        <View style={styles.footer}>
          <PrimaryButton
            label="Review parcel order"
            icon="arrow-right"
            onPress={() =>
              router.push({
                pathname: '/order-review',
                params: {
                  flow: 'parcel',
                  scope: selectedScope,
                  parcelType: activePackage.key,
                  parcelLabel: activePackage.title,
                  timing,
                  pickup: pickupLabel,
                  dropoff: dropoff.trim(),
                  recipientName: recipientName.trim(),
                  recipientPhone: recipientPhone.trim(),
                  scheduleDate: scheduledDate.trim(),
                  scheduleTime: scheduledTime.trim(),
                },
              })
            }
            style={!isFormValid ? styles.reviewButtonDisabled : undefined}
          />
        </View>
      }>
      <CargoHeader
        title="Send parcel"
        subtitle="Use your current pickup point, enter the destination, choose parcel type and set the right delivery time."
        onLeftPress={() => router.back()}
        rightIcon="bell-outline"
        onRightPress={() => router.push('/notifications')}
      />

      <SectionHeader title="Delivery area" />
      <View style={styles.scopeRow}>
        {parcelScopes.map((scope) => {
          const isActive = scope.key === selectedScope;
          return (
            <TouchableOpacity
              key={scope.key}
              style={[styles.scopeCard, isActive && styles.scopeCardActive]}
              activeOpacity={0.88}
              onPress={() => setSelectedScope(scope.key)}>
              <Text style={[styles.scopeTitle, isActive && styles.scopeTitleActive]}>{scope.label}</Text>
              <Text style={[styles.scopeSubtitle, isActive && styles.scopeSubtitleActive]}>{scope.subtitle}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <SectionHeader title="Route" />
      <View style={styles.routeCard}>
        <View style={styles.routeRow}>
          <View style={[styles.routeIconWrap, { backgroundColor: '#ECFDF3' }]}>
            <MaterialCommunityIcons name="crosshairs-gps" size={20} color={cargoTheme.colors.primary} />
          </View>
          <View style={styles.routeCopy}>
            <Text style={styles.routeLabel}>Pickup point</Text>
            <Text style={styles.routeValue}>{pickupLabel}</Text>
          </View>
        </View>

        <View style={styles.routeDivider} />

        <View style={styles.destinationBlock}>
          <View style={styles.routeRow}>
            <View style={[styles.routeIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <MaterialCommunityIcons name="flag-checkered" size={20} color="#2563EB" />
            </View>
            <View style={styles.routeCopy}>
              <Text style={styles.routeLabel}>Destination</Text>
              <Text style={styles.routeHint}>Type where the parcel should be delivered.</Text>
            </View>
          </View>

          <TextInput
            value={dropoff}
            onChangeText={setDropoff}
            placeholder={selectedScope === 'city' ? 'Masaki, Haile Selassie Road' : 'Morogoro town center'}
            placeholderTextColor="#94A3B8"
            style={styles.routeInput}
          />

          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.mapToggleButton, showMapPicker && styles.mapToggleButtonActive]}
            onPress={() => setShowMapPicker((value) => !value)}>
            <MaterialCommunityIcons
              name={showMapPicker ? 'keyboard-close-outline' : 'map-marker-plus-outline'}
              size={18}
              color={showMapPicker ? cargoTheme.colors.primaryDark : cargoTheme.colors.info}
            />
            <Text style={[styles.mapToggleText, showMapPicker && styles.mapToggleTextActive]}>
              {showMapPicker ? 'Hide map picker' : 'Pick destination on map'}
            </Text>
          </TouchableOpacity>

          {showMapPicker ? (
            <View style={styles.mapCard}>
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                showsUserLocation
                initialRegion={{
                  latitude: pickupPoint.latitude,
                  longitude: pickupPoint.longitude,
                  latitudeDelta: defaultRegion.latitudeDelta,
                  longitudeDelta: defaultRegion.longitudeDelta,
                }}
                onPress={handleMapPress}>
                <Marker coordinate={pickupPoint} title="Your location" description="Current pickup point" pinColor="#16A34A" />
                {dropoffPoint ? <Marker coordinate={dropoffPoint} title="Destination" pinColor="#2563EB" /> : null}
              </MapView>
              <Text style={styles.mapCaption}>
                Tap anywhere on the map to choose the drop-off point if typing feels slower.
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <SectionHeader title="Parcel type" />
      <View style={styles.packageGrid}>
        {availablePackages.map((item) => {
          const isActive = item.key === selectedPackage;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.packageCard, isActive && styles.packageCardActive]}
              activeOpacity={0.88}
              onPress={() => setSelectedPackage(item.key)}>
              <View style={[styles.packageIconWrap, isActive && styles.packageIconWrapActive]}>
                <MaterialCommunityIcons name={item.icon} size={22} color={isActive ? '#FFFFFF' : cargoTheme.colors.text} />
              </View>
              <Text style={[styles.packageTitle, isActive && styles.packageTitleActive]}>{item.title}</Text>
              <Text style={[styles.packageSubtitle, isActive && styles.packageSubtitleActive]}>{item.subtitle}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <SectionHeader title="Delivery timing" />
      <View style={styles.timingRow}>
        {[
          { key: 'now', label: 'Deliver now' },
          { key: 'later', label: 'Schedule for later' },
        ].map((item) => {
          const isActive = item.key === timing;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.timingChip, isActive && styles.timingChipActive]}
              onPress={() => setTiming(item.key as 'now' | 'later')}>
              <Text style={[styles.timingText, isActive && styles.timingTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {timing === 'later' ? (
        <View style={styles.scheduleCard}>
          <Text style={styles.cardTitle}>Scheduled time</Text>
          <View style={styles.scheduleRow}>
            <TextInput
              value={scheduledDate}
              onChangeText={setScheduledDate}
              placeholder="Apr 18, 2026"
              placeholderTextColor="#94A3B8"
              style={[styles.input, styles.scheduleInput]}
            />
            <TextInput
              value={scheduledTime}
              onChangeText={setScheduledTime}
              placeholder="14:30"
              placeholderTextColor="#94A3B8"
              style={[styles.input, styles.scheduleInput]}
            />
          </View>
          <Text style={styles.cardCaption}>Enter the preferred delivery date and time for dispatch.</Text>
        </View>
      ) : null}

      <SectionHeader title="Recipient details" />
      <View style={styles.recipientCard}>
        <Text style={styles.cardTitle}>Recipient</Text>
        <TextInput
          value={recipientName}
          onChangeText={setRecipientName}
          placeholder="Recipient name"
          placeholderTextColor="#94A3B8"
          style={[styles.input, styles.inputSpacing]}
        />
        <TextInput
          value={recipientPhone}
          onChangeText={setRecipientPhone}
          keyboardType="phone-pad"
          placeholder="+255 744 123 222"
          placeholderTextColor="#94A3B8"
          style={styles.input}
        />
        <Text style={styles.cardCaption}>{contactPreviewText}</Text>

        {contacts.length ? (
          <View style={styles.contactList}>
            <TextInput
              value={contactSearch}
              onChangeText={setContactSearch}
              placeholder="Search contacts by name or phone"
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
            />
            <ScrollView nestedScrollEnabled style={styles.contactScrollArea} showsVerticalScrollIndicator={false}>
              {filteredContacts.map((contact) => {
              const firstPhone = contact.phoneNumbers?.[0]?.number?.trim();
              if (!firstPhone) {
                return null;
              }

              return (
                <Pressable
                  key={`${contact.name ?? 'contact'}-${firstPhone}`}
                  onPress={() => {
                    setRecipientName(contact.name ?? '');
                    setRecipientPhone(firstPhone);
                  }}
                  style={({ pressed }) => [styles.contactChip, pressed && styles.contactChipPressed]}>
                  <MaterialCommunityIcons name="account-circle-outline" size={18} color={cargoTheme.colors.primaryDark} />
                  <View style={styles.contactCopy}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactPhone}>{firstPhone}</Text>
                  </View>
                </Pressable>
              );
              })}
              {!filteredContacts.length ? (
                <View style={styles.emptyContactsState}>
                  <Text style={styles.emptyContactsText}>No contacts match your search yet.</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Live estimate</Text>
        <SummaryRow label="Service" value={selectedScope === 'city' ? 'In-city parcel' : 'Outside-city parcel'} />
        <SummaryRow label="Parcel type" value={activePackage.title} />
        <SummaryRow label="Estimated time" value={eta} />
        <SummaryRow label="Estimated fare" value={price} emphasis />
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
  reviewButtonDisabled: {
    opacity: 0.65,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
  },
  scopeCard: {
    flex: 1,
    backgroundColor: cargoTheme.colors.surface,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
    borderRadius: 22,
    padding: 16,
  },
  scopeCardActive: {
    backgroundColor: cargoTheme.colors.primaryDark,
    borderColor: cargoTheme.colors.primaryDark,
  },
  scopeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 6,
  },
  scopeTitleActive: {
    color: '#FFFFFF',
  },
  scopeSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: cargoTheme.colors.subtext,
  },
  scopeSubtitleActive: {
    color: '#D6E0EA',
  },
  routeCard: {
    backgroundColor: cargoTheme.colors.surface,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    borderRadius: 24,
    padding: 16,
    marginBottom: 22,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    fontWeight: '800',
    color: cargoTheme.colors.text,
  },
  routeHint: {
    fontSize: 13,
    color: cargoTheme.colors.subtext,
  },
  routeDivider: {
    height: 1,
    backgroundColor: '#EDF2F7',
    marginVertical: 14,
    marginLeft: 58,
  },
  destinationBlock: {
    gap: 12,
  },
  routeInput: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
    backgroundColor: cargoTheme.colors.card,
    paddingHorizontal: 16,
    fontSize: 15,
    color: cargoTheme.colors.text,
  },
  mapToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  mapToggleButtonActive: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  mapToggleText: {
    color: cargoTheme.colors.info,
    fontSize: 14,
    fontWeight: '700',
  },
  mapToggleTextActive: {
    color: cargoTheme.colors.primaryDark,
  },
  mapCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: cargoTheme.colors.card,
  },
  map: {
    width: '100%',
    height: 220,
  },
  mapCaption: {
    color: cargoTheme.colors.subtext,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  packageGrid: {
    gap: 12,
    marginBottom: 22,
  },
  packageCard: {
    backgroundColor: cargoTheme.colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
    padding: 16,
  },
  packageCardActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  packageIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: cargoTheme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  packageIconWrapActive: {
    backgroundColor: cargoTheme.colors.primary,
  },
  packageTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 4,
  },
  packageTitleActive: {
    color: cargoTheme.colors.primaryDark,
  },
  packageSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: cargoTheme.colors.subtext,
  },
  packageSubtitleActive: {
    color: cargoTheme.colors.primaryDark,
  },
  timingRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  timingChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: cargoTheme.colors.surface,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
  },
  timingChipActive: {
    backgroundColor: '#ECFDF3',
    borderColor: '#BBF7D0',
  },
  timingText: {
    fontSize: 13,
    fontWeight: '700',
    color: cargoTheme.colors.text,
  },
  timingTextActive: {
    color: cargoTheme.colors.primaryDark,
  },
  scheduleCard: {
    backgroundColor: cargoTheme.colors.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    marginBottom: 22,
  },
  scheduleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scheduleInput: {
    flex: 1,
  },
  recipientCard: {
    backgroundColor: cargoTheme.colors.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    marginBottom: 22,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 10,
  },
  input: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
    backgroundColor: cargoTheme.colors.card,
    paddingHorizontal: 16,
    fontSize: 15,
    color: cargoTheme.colors.text,
  },
  inputSpacing: {
    marginBottom: 10,
  },
  cardCaption: {
    fontSize: 12,
    lineHeight: 18,
    color: cargoTheme.colors.subtext,
    marginTop: 10,
  },
  contactList: {
    gap: 10,
    marginTop: 12,
  },
  searchInput: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    fontSize: 14,
    color: cargoTheme.colors.text,
  },
  contactScrollArea: {
    maxHeight: 260,
    gap: 10,
  },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contactChipPressed: {
    opacity: 0.92,
  },
  contactCopy: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '700',
    color: cargoTheme.colors.text,
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 12,
    color: cargoTheme.colors.subtext,
  },
  emptyContactsState: {
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyContactsText: {
    color: cargoTheme.colors.subtext,
    fontSize: 13,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: cargoTheme.colors.darkSurface,
    borderRadius: 24,
    padding: 18,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 14,
  },
});
