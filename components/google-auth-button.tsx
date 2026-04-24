import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { cargoTheme } from '@/constants/cargo-theme';
import { typography } from '@/constants/typography';

type GoogleAuthButtonProps = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function GoogleAuthButton({ label, onPress, loading = false, disabled = false }: GoogleAuthButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      disabled={disabled || loading}
      style={[styles.button, (disabled || loading) && styles.buttonDisabled]}
      onPress={onPress}>
      <View style={styles.iconWrap}>
        {loading ? (
          <ActivityIndicator color={cargoTheme.colors.text} size="small" />
        ) : (
          <MaterialCommunityIcons name="google" size={20} color={cargoTheme.colors.text} />
        )}
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D7E2EC',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 18,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  iconWrap: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: cargoTheme.colors.text,
    fontSize: 15,
    fontFamily: typography.bold,
  },
});
