import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CargoHeader, CargoScreen, PrimaryButton } from '@/components/cargo-ui';
import { cargoTheme } from '@/constants/cargo-theme';

const supportTopics = [
  { key: 'delivery', label: 'Active delivery issue', icon: 'truck-alert-outline' },
  { key: 'payment', label: 'Payment or invoice', icon: 'credit-card-outline' },
  { key: 'account', label: 'Account and security', icon: 'shield-account-outline' },
  { key: 'pricing', label: 'Pricing and booking', icon: 'cash-multiple' },
] as const;

const quickActions = [
  { icon: 'message-text-outline', title: 'Live chat', subtitle: 'Average reply in under 5 min' },
  { icon: 'phone-outline', title: 'Call dispatch', subtitle: '+255 745 100 200' },
  { icon: 'file-document-outline', title: 'Safety guide', subtitle: 'Policies, lost items and claims' },
] as const;

type SupportTopic = (typeof supportTopics)[number]['key'];

export default function SupportCenterScreen() {
  const router = useRouter();
  const [selectedTopic, setSelectedTopic] = useState<SupportTopic>('delivery');
  const [orderId, setOrderId] = useState('');
  const [message, setMessage] = useState('');

  const messageIsValid = message.trim().length >= 12;
  const summaryText = useMemo(() => {
    const activeTopic = supportTopics.find((topic) => topic.key === selectedTopic);
    return `${activeTopic?.label ?? 'Support request'}${orderId.trim() ? ` • ${orderId.trim()}` : ''}`;
  }, [orderId, selectedTopic]);

  const submitRequest = () => {
    Alert.alert('Support request created', `We have logged your case: ${summaryText}`);
    setOrderId('');
    setMessage('');
  };

  return (
    <CargoScreen contentContainerStyle={styles.content}>
      <CargoHeader
        title="Support center"
        subtitle="Reach dispatch, report delivery issues and get help with your account."
        onLeftPress={() => router.back()}
      />

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>How can we help today?</Text>
        <Text style={styles.heroText}>
          Choose a topic, add your order reference if you have one, and send a clear message to support.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
        {quickActions.map((action, index) => (
          <View key={action.title} style={[styles.actionRow, index !== quickActions.length - 1 && styles.rowBorder]}>
            <View style={styles.actionIcon}>
              <MaterialCommunityIcons name={action.icon} size={20} color={cargoTheme.colors.primaryDark} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionText}>{action.subtitle}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Create a support request</Text>

        <View style={styles.topicsGrid}>
          {supportTopics.map((topic) => {
            const isActive = topic.key === selectedTopic;
            return (
              <Pressable
                key={topic.key}
                onPress={() => setSelectedTopic(topic.key)}
                style={({ pressed }) => [
                  styles.topicChip,
                  isActive && styles.topicChipActive,
                  pressed && styles.topicChipPressed,
                ]}>
                <MaterialCommunityIcons
                  name={topic.icon}
                  size={18}
                  color={isActive ? cargoTheme.colors.primaryDark : cargoTheme.colors.subtext}
                />
                <Text style={[styles.topicText, isActive && styles.topicTextActive]}>{topic.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Order ID or booking ref</Text>
          <TextInput
            value={orderId}
            onChangeText={setOrderId}
            placeholder="DD-20481"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Describe the issue, what happened, and what help you need."
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
            style={styles.textarea}
          />
        </View>

        <View style={styles.summaryCard}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={18} color={cargoTheme.colors.info} />
          <Text style={styles.summaryText}>{summaryText}</Text>
        </View>

        {!messageIsValid ? <Text style={styles.validationText}>Please add a little more detail so support can help properly.</Text> : null}

        <PrimaryButton label="Send request" icon="send-outline" onPress={submitRequest} style={!messageIsValid ? styles.buttonDisabled : undefined} />
      </View>
    </CargoScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
  heroCard: {
    backgroundColor: cargoTheme.colors.darkSurface,
    borderRadius: 28,
    padding: 20,
    marginBottom: 18,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroText: {
    color: '#D6E0EA',
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    backgroundColor: cargoTheme.colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    gap: 14,
  },
  sectionTitle: {
    color: cargoTheme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: cargoTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
    gap: 3,
  },
  actionTitle: {
    color: cargoTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  actionText: {
    color: cargoTheme.colors.subtext,
    fontSize: 13,
  },
  topicsGrid: {
    gap: 10,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
    backgroundColor: cargoTheme.colors.card,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  topicChipActive: {
    borderColor: '#86EFAC',
    backgroundColor: cargoTheme.colors.primarySoft,
  },
  topicChipPressed: {
    opacity: 0.92,
  },
  topicText: {
    flex: 1,
    color: cargoTheme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  topicTextActive: {
    color: cargoTheme.colors.primaryDark,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: cargoTheme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
    backgroundColor: cargoTheme.colors.card,
    paddingHorizontal: 16,
    fontSize: 15,
    color: cargoTheme.colors.text,
  },
  textarea: {
    minHeight: 132,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cargoTheme.colors.line,
    backgroundColor: cargoTheme.colors.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: cargoTheme.colors.text,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: cargoTheme.colors.infoSoft,
    borderRadius: 18,
    padding: 14,
  },
  summaryText: {
    flex: 1,
    color: '#1D4ED8',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  validationText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
