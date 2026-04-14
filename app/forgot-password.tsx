import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ForgotPassword() {
  const router = useRouter();
  const [phone, setPhone] = useState('');

  const sendReset = () => {
    // Placeholder: send reset code
    router.replace('/login');
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Forgot password</ThemedText>
      <ThemedText type="subtitle">Enter your phone to receive reset instructions.</ThemedText>
      <View style={styles.form}>
        <TextInput placeholder="Phone number" value={phone} onChangeText={setPhone} style={styles.input} />
        <TouchableOpacity style={styles.button} onPress={sendReset}>
          <Text style={styles.buttonText}>Send reset</Text>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-start', alignItems: 'flex-start', padding: 24, paddingTop: 64 },
  form: { width: '100%', maxWidth: 420, marginTop: 12 },
  input: { height: 48, borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#fff', marginBottom: 12 },
  button: { height: 50, backgroundColor: '#28A745', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
