import 'react-native-reanimated';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';

import { cargoTheme } from '@/constants/cargo-theme';
import { typography } from '@/constants/typography';
import { useColorScheme } from '@/hooks/use-color-scheme';

void ExpoSplashScreen.preventAutoHideAsync().catch(() => null);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [startupTimedOut, setStartupTimedOut] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const appAssetsReady = fontsLoaded || Boolean(fontError) || startupTimedOut;

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setStartupTimedOut(true);
    }, 2500);

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!appAssetsReady) {
      return;
    }

    ExpoSplashScreen.hideAsync().catch(() => null);
  }, [appAssetsReady]);

  if (!appAssetsReady) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <RootNavigator />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errorBoundary}>
      <Text style={styles.errorTitle}>DoorDrop hit a screen error</Text>
      <Text style={styles.errorMessage}>
        {error.message || 'A route failed while loading. Retry to continue into the app.'}
      </Text>
      <TouchableOpacity activeOpacity={0.88} style={styles.errorButton} onPress={retry}>
        <Text style={styles.errorButtonText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

function RootNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="splash" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="terms" options={{ headerShown: false }} />
      <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="explore" options={{ headerShown: false }} />
      <Stack.Screen name="menu" />
      <Stack.Screen name="send-parcel" />
      <Stack.Screen name="book-cargo" />
      <Stack.Screen name="order-review" />
      <Stack.Screen name="order-created" />
      <Stack.Screen name="track-order" />
      <Stack.Screen name="history" />
      <Stack.Screen name="account" />
      <Stack.Screen name="saved-places" />
      <Stack.Screen name="policies" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="profile-edit" />
      <Stack.Screen name="support-center" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  errorBoundary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F8FAFC',
  },
  errorTitle: {
    color: cargoTheme.colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: typography.extrabold,
    textAlign: 'center',
    marginBottom: 10,
  },
  errorMessage: {
    color: cargoTheme.colors.subtext,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 18,
    maxWidth: 340,
  },
  errorButton: {
    minHeight: 52,
    minWidth: 160,
    borderRadius: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cargoTheme.colors.primary,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: typography.extrabold,
  },
});
