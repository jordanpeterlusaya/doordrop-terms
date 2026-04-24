import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { cargoTheme } from '@/constants/cargo-theme';
import { typography } from '@/constants/typography';

type AuthIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type AuthShellProps = {
  badge: string;
  title: string;
  subtitle: string;
  helperText: string;
  helperTone?: 'neutral' | 'error' | 'success';
  highlights: {
    icon: AuthIconName;
    title: string;
    description: string;
  }[];
  children: ReactNode;
};

export function AuthShell({
  badge,
  title,
  subtitle,
  helperText,
  helperTone = 'neutral',
  highlights,
  children,
}: AuthShellProps) {
  const helperStyles = {
    neutral: {
      backgroundColor: '#F8FAFC',
      borderColor: '#E2E8F0',
      icon: cargoTheme.colors.info,
      text: cargoTheme.colors.subtext,
      iconName: 'information-outline' as AuthIconName,
    },
    error: {
      backgroundColor: '#FEF2F2',
      borderColor: '#FECACA',
      icon: '#DC2626',
      text: '#991B1B',
      iconName: 'alert-circle-outline' as AuthIconName,
    },
    success: {
      backgroundColor: '#F0FDF4',
      borderColor: '#BBF7D0',
      icon: cargoTheme.colors.primary,
      text: cargoTheme.colors.primaryDark,
      iconName: 'check-circle-outline' as AuthIconName,
    },
  }[helperTone];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <LinearGradient colors={['#14532D', '#166534', '#0F3D2E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroBadge}>
              <MaterialCommunityIcons name="shield-check-outline" size={16} color="#14532D" />
              <Text style={styles.heroBadgeText}>{badge}</Text>
            </View>

            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroSubtitle}>{subtitle}</Text>

            <View style={styles.highlightList}>
              {highlights.map((item) => (
                <View key={item.title} style={styles.highlightCard}>
                  <View style={styles.highlightIconWrap}>
                    <MaterialCommunityIcons name={item.icon} size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.highlightCopy}>
                    <Text style={styles.highlightTitle}>{item.title}</Text>
                    <Text style={styles.highlightDescription}>{item.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </LinearGradient>

          <View style={styles.formCard}>
            <View
              style={[
                styles.helperCard,
                {
                  backgroundColor: helperStyles.backgroundColor,
                  borderColor: helperStyles.borderColor,
                },
              ]}>
              <MaterialCommunityIcons name={helperStyles.iconName} size={18} color={helperStyles.icon} />
              <Text style={[styles.helperText, { color: helperStyles.text }]}>{helperText}</Text>
            </View>

            <View style={styles.formContent}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EEF5F0',
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 18,
  },
  hero: {
    borderRadius: 30,
    padding: 22,
    gap: 14,
    overflow: 'hidden',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
  },
  heroBadgeText: {
    color: '#14532D',
    fontSize: 12,
    fontFamily: typography.bold,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 29,
    lineHeight: 34,
    fontFamily: typography.extrabold,
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    color: '#DCFCE7',
    fontSize: 14,
    lineHeight: 21,
  },
  highlightList: {
    gap: 12,
    marginTop: 4,
  },
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(220,252,231,0.18)',
  },
  highlightIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  highlightCopy: {
    flex: 1,
    gap: 4,
  },
  highlightTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: typography.bold,
  },
  highlightDescription: {
    color: '#D7F9E2',
    fontSize: 12,
    lineHeight: 18,
  },
  formCard: {
    borderRadius: 30,
    padding: 20,
    gap: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 28,
    elevation: 6,
  },
  helperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  helperText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  formContent: {
    gap: 14,
  },
});
