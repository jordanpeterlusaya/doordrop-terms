import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AuthSessionBoundary } from '@/components/auth/session-boundary';
import { CargoHeader, CargoScreen, PrimaryButton } from '@/components/cargo-ui';
import { cargoTheme } from '@/constants/cargo-theme';
import { upsertUserProfile } from '@/lib/user-profile';
import { useAuthSession } from '@/providers/auth-provider';

function ProfileEditScreenContent() {
  const router = useRouter();
  const { profile, refreshProfile, user } = useAuthSession();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Dar es Salaam');
  const [defaultPayment, setDefaultPayment] = useState('Cash on delivery');
  const [orderAlerts, setOrderAlerts] = useState(true);
  const [promoAlerts, setPromoAlerts] = useState(false);

  const emailIsValid = /\S+@\S+\.\S+/.test(email.trim());
  const phoneIsValid = phone.replace(/\D/g, '').length >= 9;
  const formIsValid = fullName.trim().length >= 2 && emailIsValid && phoneIsValid && city.trim().length >= 2;
  const initials = useMemo(
    () =>
      fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'DD',
    [fullName]
  );

  useEffect(() => {
    setFullName(profile?.fullName || user?.displayName || '');
    setPhone(profile?.phoneNumber || user?.phoneNumber || '');
    setEmail(user?.email || '');
  }, [profile?.fullName, profile?.phoneNumber, user?.displayName, user?.email, user?.phoneNumber]);

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Profile unavailable', 'Sign in again to update your profile.');
      return;
    }

    try {
      await upsertUserProfile({
        uid: user.uid,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: phone.trim(),
        phoneVerified: true,
      });
      await refreshProfile();
      Alert.alert('Profile updated', 'Your account details and notification preferences have been saved.');
      router.back();
    } catch {
      Alert.alert('Save failed', 'Please try again.');
    }
  };

  return (
    <CargoScreen contentContainerStyle={styles.content}>
      <CargoHeader
        title="Edit profile"
        subtitle="Update your business details, contact info and notification preferences."
        onLeftPress={() => router.back()}
      />

      <View style={styles.profileHero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{fullName || 'Your profile'}</Text>
          <Text style={styles.profileMeta}>{city || 'Add your city'} • {defaultPayment}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Business details</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Full name or business name</Text>
          <TextInput value={fullName} onChangeText={setFullName} placeholder="Enter profile name" placeholderTextColor="#94A3B8" style={styles.input} />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone number</Text>
          <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+255 742 000 111" placeholderTextColor="#94A3B8" style={styles.input} />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email address</Text>
          <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="ops@doordrop.co.tz" placeholderTextColor="#94A3B8" style={styles.input} />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>City</Text>
          <TextInput value={city} onChangeText={setCity} placeholder="Dar es Salaam" placeholderTextColor="#94A3B8" style={styles.input} />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Default payment method</Text>
          <TextInput value={defaultPayment} onChangeText={setDefaultPayment} placeholder="Cash on delivery" placeholderTextColor="#94A3B8" style={styles.input} />
        </View>

        {!formIsValid ? <Text style={styles.validationText}>Complete all profile fields with valid contact details to save changes.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Order updates</Text>
            <Text style={styles.toggleText}>Receive ETA, pickup and delivery status alerts.</Text>
          </View>
          <Switch
            value={orderAlerts}
            onValueChange={setOrderAlerts}
            trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
            thumbColor={orderAlerts ? cargoTheme.colors.primary : '#FFFFFF'}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Promotions</Text>
            <Text style={styles.toggleText}>Get occasional discounts and new service announcements.</Text>
          </View>
          <Switch
            value={promoAlerts}
            onValueChange={setPromoAlerts}
            trackColor={{ false: '#CBD5E1', true: '#BFDBFE' }}
            thumbColor={promoAlerts ? cargoTheme.colors.info : '#FFFFFF'}
          />
        </View>
      </View>

      <View style={styles.tipCard}>
        <MaterialCommunityIcons name="shield-check-outline" size={18} color={cargoTheme.colors.primaryDark} />
        <Text style={styles.tipText}>Keep your phone number updated so drivers and dispatch can reach you during active deliveries.</Text>
      </View>

      <PrimaryButton label="Save changes" icon="content-save-outline" onPress={handleSave} style={!formIsValid ? styles.buttonDisabled : undefined} />
    </CargoScreen>
  );
}

export default function ProfileEditScreen() {
  return (
    <AuthSessionBoundary>
      <ProfileEditScreenContent />
    </AuthSessionBoundary>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
  profileHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: cargoTheme.colors.darkSurface,
    borderRadius: 28,
    padding: 20,
    marginBottom: 18,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  profileCopy: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  profileMeta: {
    color: '#D6E0EA',
    fontSize: 13,
  },
  card: {
    backgroundColor: cargoTheme.colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    gap: 14,
  },
  sectionTitle: {
    color: cargoTheme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: cargoTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
    backgroundColor: cargoTheme.colors.card,
    paddingHorizontal: 16,
    fontSize: 15,
    color: cargoTheme.colors.text,
  },
  validationText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    justifyContent: 'space-between',
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    color: cargoTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  toggleText: {
    color: cargoTheme.colors.subtext,
    fontSize: 13,
    lineHeight: 19,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: cargoTheme.colors.primarySoft,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  tipText: {
    flex: 1,
    color: cargoTheme.colors.primaryDark,
    fontSize: 13,
    lineHeight: 19,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
