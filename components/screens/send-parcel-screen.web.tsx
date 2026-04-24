import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CargoHeader, CargoScreen, PrimaryButton } from '@/components/cargo-ui';
import { cargoTheme } from '@/constants/cargo-theme';

export default function SendParcelWebScreen() {
  const router = useRouter();

  return (
    <CargoScreen contentContainerStyle={styles.content}>
      <CargoHeader
        title="Send parcel"
        subtitle="Web preview for the mobile booking flow."
        leftAction="none"
      />

      <View style={styles.card}>
        <Text style={styles.title}>Parcel booking stays in the mobile app</Text>
        <Text style={styles.text}>
          The live parcel booking flow uses device location, map pinning, and mobile contact access. On the web we keep this page lightweight while the app still owns the real booking experience.
        </Text>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>How the real flow works</Text>
        <Text style={styles.noticeText}>1. A signed-in customer creates the parcel order in the mobile app.</Text>
        <Text style={styles.noticeText}>2. The order is saved into Firestore.</Text>
        <Text style={styles.noticeText}>3. DoorDrop dispatch reviews it and assigns a driver.</Text>
      </View>

      <PrimaryButton label="Back to web home" variant="secondary" onPress={() => router.replace('/home')} />
    </CargoScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
    gap: 18,
  },
  card: {
    borderRadius: 28,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 10,
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
    color: cargoTheme.colors.subtext,
  },
  notice: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 10,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
    color: cargoTheme.colors.subtext,
    marginBottom: 4,
  },
});
