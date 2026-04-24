import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Image, StatusBar, StyleSheet, Text, View } from 'react-native';

import { cargoTheme } from '@/constants/cargo-theme';
import { typography } from '@/constants/typography';

const splashLogo = require('../assets/images/image1-app-icon-pro.png');

export default function SplashScreen() {
  const router = useRouter();
  const navigationCommittedRef = useRef(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (navigationCommittedRef.current) {
        return;
      }

      navigationCommittedRef.current = true;
      router.replace('/home');
    }, 650);

    return () => clearTimeout(timeoutId);
  }, [router]);

  return (
    <LinearGradient colors={['#F5FFF7', '#ECFDF3', '#DFF6E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5FFF7" />

      <View style={styles.logoWrap}>
        <Image source={splashLogo} style={styles.logo} resizeMode="contain" />
      </View>

      <View style={styles.copyWrap}>
        <Text style={styles.title}>DoorDrop</Text>
        <Text style={styles.subtitle}>
          Starting the customer app with a lighter flow so the APK can open safely before any account steps are needed.
        </Text>
      </View>

      <View style={styles.loaderRow}>
        <ActivityIndicator size="small" color={cargoTheme.colors.primaryDark} />
        <Text style={styles.loaderText}>Opening dashboard...</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logoWrap: {
    width: 148,
    height: 148,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 36,
    elevation: 8,
    marginBottom: 28,
  },
  logo: {
    width: 112,
    height: 112,
  },
  copyWrap: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 26,
  },
  title: {
    color: cargoTheme.colors.primaryDark,
    fontSize: 30,
    fontFamily: typography.extrabold,
    letterSpacing: -0.8,
  },
  subtitle: {
    color: '#3F5F52',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 320,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  loaderText: {
    color: cargoTheme.colors.primaryDark,
    fontSize: 13,
    fontFamily: typography.bold,
  },
});
