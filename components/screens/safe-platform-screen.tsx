import { useRouter } from 'expo-router';
import type { ComponentType } from 'react';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { CargoScreen, PrimaryButton } from '@/components/cargo-ui';
import { cargoTheme } from '@/constants/cargo-theme';
import { typography } from '@/constants/typography';

type ScreenModule = {
  default: ComponentType;
};

type SafePlatformScreenProps = {
  loadNative: () => ScreenModule;
  loadWeb?: () => ScreenModule;
  screenName: string;
};

export function SafePlatformScreen({ loadNative, loadWeb, screenName }: SafePlatformScreenProps) {
  const router = useRouter();
  const fallbackRoute = screenName === 'Home' ? '/explore' : '/home';
  const fallbackLabel = screenName === 'Home' ? 'Open explore' : 'Go to home';

  try {
    const module = Platform.OS === 'web' && loadWeb ? loadWeb() : loadNative();
    const Screen = module.default;

    return <Screen />;
  } catch (error) {
    console.error(`Failed to load ${screenName} screen`, error);

    return (
      <CargoScreen contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{screenName} is temporarily unavailable</Text>
          <Text style={styles.body}>
            This build skipped a screen module that did not load safely on the current device. The
            rest of the app can still open.
          </Text>
          <PrimaryButton label={fallbackLabel} onPress={() => router.replace(fallbackRoute)} />
        </View>
      </CargoScreen>
    );
  }
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 32,
  },
  card: {
    borderRadius: 28,
    padding: 20,
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: {
    color: cargoTheme.colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: typography.extrabold,
  },
  body: {
    color: cargoTheme.colors.subtext,
    fontSize: 14,
    lineHeight: 21,
  },
});
