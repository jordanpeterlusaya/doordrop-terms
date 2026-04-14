import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { cargoTheme } from '@/constants/cargo-theme';

const EAST_AFRICA = [
  { code: '+255', label: 'Tanzania', iso: 'TZ', emoji: '🇹🇿' },
  { code: '+254', label: 'Kenya', iso: 'KE', emoji: '🇰🇪' },
  { code: '+256', label: 'Uganda', iso: 'UG', emoji: '🇺🇬' },
  { code: '+250', label: 'Rwanda', iso: 'RW', emoji: '🇷🇼' },
  { code: '+257', label: 'Burundi', iso: 'BI', emoji: '🇧🇮' },
  { code: '+211', label: 'South Sudan', iso: 'SS', emoji: '🇸🇸' },
  { code: '+251', label: 'Ethiopia', iso: 'ET', emoji: '🇪🇹' },
] as const;

type CountryOption = (typeof EAST_AFRICA)[number];

export default function LoginScreen() {
  const router = useRouter();
  const [country, setCountry] = useState<CountryOption>(EAST_AFRICA[0]);
  const [showCountries, setShowCountries] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const phoneDigits = phone.replace(/\D/g, '');
  const isFormValid = phoneDigits.length >= 9 && password.trim().length >= 6;
  const helperText = useMemo(() => {
    if (!phone.length) {
      return 'Use the number linked to your DoorDrop profile.';
    }

    if (phoneDigits.length < 9) {
      return 'Enter a valid mobile number to continue.';
    }

    if (password.length > 0 && password.trim().length < 6) {
      return 'Password should be at least 6 characters.';
    }

    return 'Everything looks good. You can sign in now.';
  }, [password, phone.length, phoneDigits.length]);

  const signIn = () => {
    router.replace('/home');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Login to your account</Text>
              <Text style={styles.cardSubtitle}>Use your phone number and password to continue.</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone number</Text>
              <View style={styles.phoneRow}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.countryButton}
                  onPress={() => setShowCountries((value) => !value)}>
                  <View>
                    <Text style={styles.countryBadge}>{country.emoji}</Text>
                    <Text style={styles.countryCode}>{country.code}</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={showCountries ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={cargoTheme.colors.subtext}
                  />
                </TouchableOpacity>

                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="742 000 111"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  style={styles.phoneInput}
                />
              </View>

              {showCountries ? (
                <View style={styles.dropdown}>
                  {EAST_AFRICA.map((entry) => (
                    <Pressable
                      key={entry.code}
                      onPress={() => {
                        setCountry(entry);
                        setShowCountries(false);
                      }}
                      style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}>
                      <Text style={styles.dropdownCode}>{entry.emoji}</Text>
                      <View style={styles.dropdownCopy}>
                        <Text style={styles.dropdownTitle}>{entry.label}</Text>
                        <Text style={styles.dropdownSubtitle}>{entry.code}</Text>
                      </View>
                      {country.code === entry.code ? (
                        <MaterialCommunityIcons name="check-circle" size={18} color={cargoTheme.colors.primary} />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity onPress={() => router.push('/forgot-password')}>
                  <Text style={styles.inlineLink}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.passwordWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  style={styles.textInput}
                />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((value) => !value)}>
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={cargoTheme.colors.subtext}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.helperBanner}>
              <MaterialCommunityIcons
                name={isFormValid ? 'check-decagram-outline' : 'information-outline'}
                size={18}
                color={isFormValid ? cargoTheme.colors.primary : cargoTheme.colors.info}
              />
              <Text style={styles.helperText}>{helperText}</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              disabled={!isFormValid}
              style={[styles.primaryButton, !isFormValid && styles.primaryButtonDisabled]}
              onPress={signIn}>
              <Text style={styles.primaryButtonText}>Sign in</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity activeOpacity={0.9} style={styles.socialButton}>
                <MaterialCommunityIcons name="google" size={18} color="#DB4437" />
                <Text style={styles.socialButtonText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.9} style={styles.socialButton}>
                <MaterialCommunityIcons name="apple" size={18} color={cargoTheme.colors.text} />
                <Text style={styles.socialButtonText}>Apple</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>New to DoorDrop?</Text>
              <TouchableOpacity onPress={() => router.push('/register')}>
                <Text style={styles.footerLink}>Create an account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: cargoTheme.colors.canvas,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    justifyContent: 'center',
  },
  card: {
    borderRadius: cargoTheme.radius.xl,
    backgroundColor: cargoTheme.colors.surface,
    padding: 20,
    gap: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 4,
  },
  cardHeader: {
    gap: 6,
  },
  cardTitle: {
    color: cargoTheme.colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    color: cargoTheme.colors.subtext,
    fontSize: 14,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 10,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: cargoTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  inlineLink: {
    color: cargoTheme.colors.info,
    fontSize: 13,
    fontWeight: '700',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
  },
  countryButton: {
    width: 122,
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countryBadge: {
    color: cargoTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  countryCode: {
    color: cargoTheme.colors.subtext,
    fontSize: 13,
    marginTop: 2,
  },
  phoneInput: {
    flex: 1,
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    fontSize: 15,
    color: cargoTheme.colors.text,
  },
  dropdown: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
    backgroundColor: cargoTheme.colors.surface,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemPressed: {
    backgroundColor: '#F8FAFC',
  },
  dropdownCode: {
    width: 28,
    color: cargoTheme.colors.text,
    fontWeight: '800',
  },
  dropdownCopy: {
    flex: 1,
    gap: 2,
  },
  dropdownTitle: {
    color: cargoTheme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownSubtitle: {
    color: cargoTheme.colors.subtext,
    fontSize: 13,
  },
  passwordWrap: {
    position: 'relative',
  },
  textInput: {
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
    backgroundColor: '#F8FAFC',
    paddingLeft: 16,
    paddingRight: 48,
    fontSize: 15,
    color: cargoTheme.colors.text,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  helperBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  helperText: {
    flex: 1,
    color: cargoTheme.colors.subtext,
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: cargoTheme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonDisabled: {
    backgroundColor: '#86C99A',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 18,
    backgroundColor: cargoTheme.colors.primarySoft,
    padding: 14,
  },
  supportIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportCopy: {
    flex: 1,
    gap: 3,
  },
  supportTitle: {
    color: cargoTheme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '800',
  },
  supportText: {
    color: '#3F5F4A',
    fontSize: 13,
    lineHeight: 19,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: cargoTheme.colors.line,
  },
  dividerText: {
    color: cargoTheme.colors.subtext,
    fontSize: 13,
    fontWeight: '600',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialButtonText: {
    color: cargoTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  footerText: {
    color: cargoTheme.colors.subtext,
    fontSize: 14,
  },
  footerLink: {
    color: cargoTheme.colors.info,
    fontSize: 14,
    fontWeight: '800',
  },
});
