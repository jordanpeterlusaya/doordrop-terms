import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function PrivacyPolicy() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Privacy Policy</ThemedText>
      <View style={styles.content}>
        <Text>Placeholder privacy policy. Replace with your legal text.</Text>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-start', alignItems: 'flex-start', padding: 24, paddingTop: 64 },
  content: { marginTop: 12 },
});
