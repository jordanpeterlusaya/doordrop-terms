import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const heroWidth = Math.min(screenWidth * 0.76, 340);
const heroHeight = heroWidth * 1.1;

const serviceHighlights = [
  { icon: 'silverware-fork-knife', label: 'Food' },
  { icon: 'pill', label: 'Pharmacy' },
  { icon: 'truck-fast-outline', label: 'Cargo' },
] as const;

// Module-level flag prevents double requests during development strict-mode
let permissionsRequested = false;

export default function SplashScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const floatAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnimation, {
          toValue: 1,
          duration: 2600,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnimation, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [floatAnimation]);

  useEffect(() => {
    let isMounted = true;

    const doRequest = async () => {
      if (permissionsRequested) {
        return;
      }

      permissionsRequested = true;
      if (isMounted) {
        setLoading(true);
      }

      await Promise.allSettled([
        Location.requestForegroundPermissionsAsync(),
        Contacts.requestPermissionsAsync(),
      ]);

      if (isMounted) {
        setLoading(false);
      }
    };

    doRequest();

    return () => {
      isMounted = false;
    };
  }, []);

  const heroTranslateY = floatAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const continueToApp = () => router.push('/login');

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#06130E', '#0D241A', '#163826', '#1B4A31']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="none" style={[styles.glowOrb, styles.glowTopRight]} />
      <View pointerEvents="none" style={[styles.glowOrb, styles.glowBottomLeft]} />
      <View pointerEvents="none" style={styles.meshHalo} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.topSection}>
            <View style={styles.heroVisualWrap}>
              <Animated.View style={[styles.heroShell, { transform: [{ translateY: heroTranslateY }] }]}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.05)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCard}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.02)']}
                    start={{ x: 0.1, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroImageGlow}>
                    <Image
                      source={require('@/assets/images/splash.png')}
                      style={styles.heroImage}
                      resizeMode="contain"
                    />
                  </LinearGradient>
                </LinearGradient>
              </Animated.View>
            </View>

            <View style={styles.copyBlock}>
              <Text style={styles.headline}>Fast delivery for food, pharmacy and cargo.</Text>
              <Text style={styles.subheadline}>
                Book local pickups and drop-offs in minutes.
              </Text>
            </View>

            <View style={styles.serviceRow}>
              {serviceHighlights.map((item) => (
                <View key={item.label} style={styles.serviceChip}>
                  <MaterialCommunityIcons name={item.icon} size={16} color="#E8FFF1" />
                  <Text style={styles.serviceChipText}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.bottomPanel}>
            <Pressable onPress={continueToApp} style={({ pressed }) => [styles.ctaPressable, pressed && styles.ctaPressed]}>
              <LinearGradient
                colors={loading ? ['#15803D', '#14532D'] : ['#22C55E', '#15803D']}
                start={{ x: 0, y: 0.2 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaButton}>
                <View style={styles.ctaTextBlock}>
                  <Text style={styles.ctaTitle}>{loading ? 'Preparing your experience' : 'Get Started'}</Text>
                  <Text style={styles.ctaSubtitle}>{loading ? 'This will only take a moment' : 'Continue to secure sign in'}</Text>
                </View>

                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <MaterialCommunityIcons name="arrow-right" size={22} color="#FFFFFF" />
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#07120E',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: screenHeight,
    paddingHorizontal: 24,
    paddingTop: Platform.select({
      ios: 18,
      android: 34,
      default: 24,
    }),
    paddingBottom: 28,
    justifyContent: 'space-between',
    gap: 28,
  },
  topSection: {
    gap: 20,
    alignItems: 'center',
  },
  heroVisualWrap: {
    height: heroHeight + 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroShell: {
    width: heroWidth + 38,
    borderRadius: 34,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.28,
        shadowOffset: { width: 0, height: 18 },
        shadowRadius: 28,
      },
      android: {
        elevation: 18,
      },
      default: {},
    }),
  },
  heroCard: {
    borderRadius: 34,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroImageGlow: {
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,16,11,0.24)',
  },
  heroImage: {
    width: heroWidth,
    height: heroHeight,
  },
  copyBlock: {
    gap: 10,
    alignItems: 'center',
  },
  headline: {
    color: '#FFFFFF',
    fontSize: screenWidth < 380 ? 30 : 34,
    lineHeight: screenWidth < 380 ? 36 : 40,
    fontWeight: '800',
    letterSpacing: -0.9,
    textAlign: 'center',
  },
  subheadline: {
    color: '#C6D6CE',
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 420,
    textAlign: 'center',
  },
  serviceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  serviceChipText: {
    color: '#E8FFF1',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomPanel: {
    gap: 12,
    padding: 18,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 18 },
        shadowRadius: 24,
      },
      android: {
        elevation: 10,
      },
      default: {},
    }),
  },
  ctaPressable: {
    borderRadius: 22,
  },
  ctaPressed: {
    opacity: 0.92,
  },
  ctaButton: {
    minHeight: 76,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaTextBlock: {
    gap: 4,
    flexShrink: 1,
    paddingRight: 12,
  },
  ctaTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },
  ctaSubtitle: {
    color: '#E7F8EC',
    fontSize: 13,
    lineHeight: 18,
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.18)',
  },
  glowTopRight: {
    width: 240,
    height: 240,
    top: -64,
    right: -70,
  },
  glowBottomLeft: {
    width: 220,
    height: 220,
    bottom: 110,
    left: -90,
    backgroundColor: 'rgba(132,204,22,0.10)',
  },
  meshHalo: {
    position: 'absolute',
    width: screenWidth * 1.1,
    height: screenWidth * 1.1,
    alignSelf: 'center',
    top: 170,
    left: -screenWidth * 0.05,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    opacity: 0.55,
  },
});
