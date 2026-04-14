import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function Terms() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Terms & Conditions</ThemedText>
      <View style={styles.content}>
        <Text>Placeholder terms and conditions. Replace with your legal text.</Text>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-start', alignItems: 'flex-start', padding: 24, paddingTop: 64 },
  content: { marginTop: 12 },
});
