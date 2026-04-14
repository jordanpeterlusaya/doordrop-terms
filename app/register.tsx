import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { cargoTheme } from '@/constants/cargo-theme';

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const trimmedPassword = password.trim();
  const trimmedConfirmPassword = confirmPassword.trim();
  const passwordIsLongEnough = trimmedPassword.length >= 6;
  const passwordsMatch = trimmedPassword.length > 0 && trimmedPassword === trimmedConfirmPassword;
  const emailLooksValid = /\S+@\S+\.\S+/.test(email.trim());
  const phoneLooksValid = phone.replace(/\D/g, '').length >= 9;
  const isFormValid =
    fullName.trim().length >= 2 &&
    emailLooksValid &&
    phoneLooksValid &&
    passwordIsLongEnough &&
    passwordsMatch &&
    acceptedTerms;

  const passwordStrengthLabel = useMemo(() => {
    if (!password.length) {
      return 'Use at least 6 characters for a secure password.';
    }

    if (trimmedPassword.length < 6) {
      return 'Too short. Add a few more characters.';
    }

    if (!/[A-Z]/.test(trimmedPassword) || !/[0-9]/.test(trimmedPassword)) {
      return 'Good start. Add a capital letter and a number for stronger security.';
    }

    return 'Strong password. Your account setup looks ready.';
  }, [password.length, trimmedPassword]);

  const createAccount = () => {
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
              <Text style={styles.cardTitle}>Create your DoorDrop account</Text>
              <Text style={styles.cardSubtitle}>Fill in the details below to open your account.</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.textInput}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone number</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+255 742 000 111"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                style={styles.textInput}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Create a password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
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

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repeat your password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showConfirmPassword}
                  style={styles.passwordInput}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword((value) => !value)}>
                  <MaterialCommunityIcons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={cargoTheme.colors.subtext}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.infoCard}>
              <MaterialCommunityIcons
                name={passwordIsLongEnough && passwordsMatch ? 'shield-check-outline' : 'lock-outline'}
                size={18}
                color={passwordIsLongEnough && passwordsMatch ? cargoTheme.colors.primary : cargoTheme.colors.info}
              />
              <Text style={styles.infoText}>{passwordStrengthLabel}</Text>
            </View>

            {!passwordsMatch && confirmPassword.length > 0 ? (
              <Text style={styles.validationText}>Passwords do not match yet.</Text>
            ) : null}
            {!emailLooksValid && email.length > 0 ? (
              <Text style={styles.validationText}>Enter a valid email address.</Text>
            ) : null}

            <View style={styles.termsCard}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}
                onPress={() => setAcceptedTerms((value) => !value)}>
                {acceptedTerms ? <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" /> : null}
              </TouchableOpacity>
              <View style={styles.termsCopy}>
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text style={styles.termsLink} onPress={() => router.push('/terms')}>
                    Terms & Conditions
                  </Text>{' '}
                  and{' '}
                  <Text style={styles.termsLink} onPress={() => router.push('/privacy-policy')}>
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </View>
            </View>

            <Pressable
              disabled={!isFormValid}
              onPress={createAccount}
              style={({ pressed }) => [
                styles.primaryButton,
                !isFormValid && styles.primaryButtonDisabled,
                pressed && isFormValid && styles.primaryButtonPressed,
              ]}>
              <Text style={styles.primaryButtonText}>Create account</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
            </Pressable>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.footerLink}>Sign in</Text>
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
    backgroundColor: '#FFFFFF',
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  label: {
    color: cargoTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  textInput: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    fontSize: 15,
    color: cargoTheme.colors.text,
  },
  passwordWrap: {
    position: 'relative',
  },
  passwordInput: {
    minHeight: 56,
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  infoText: {
    flex: 1,
    color: cargoTheme.colors.subtext,
    fontSize: 13,
    lineHeight: 19,
  },
  validationText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    marginTop: -4,
  },
  termsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    padding: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: cargoTheme.colors.primary,
    borderColor: cargoTheme.colors.primary,
  },
  termsCopy: {
    flex: 1,
  },
  termsText: {
    color: cargoTheme.colors.subtext,
    fontSize: 13,
    lineHeight: 20,
  },
  termsLink: {
    color: cargoTheme.colors.info,
    fontWeight: '700',
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
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
