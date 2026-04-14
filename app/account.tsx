import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BottomNav, CargoHeader, MenuRow, CargoScreen, PrimaryButton } from '@/components/cargo-ui';
import { accountSections, cargoTheme } from '@/constants/cargo-theme';

export default function AccountScreen() {
  const router = useRouter();

  return (
    <CargoScreen contentContainerStyle={styles.content} footer={<BottomNav activeTab="account" />}>
      <CargoHeader
        title="Account"
        subtitle="Manage profile details, payment preferences, saved places and support."
        leftAction="menu"
        onLeftPress={() => router.push('/menu')}
        rightIcon="history"
        onRightPress={() => router.push('/history')}
      />

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>DS</Text>
        </View>
        <Text style={styles.profileName}>DoorDrop Studio</Text>
        <Text style={styles.profileMeta}>Business sender • Dar es Salaam</Text>
        <TouchableOpacity style={styles.editProfileButton} onPress={() => router.push('/profile-edit')}>
          <Text style={styles.editProfileText}>Edit profile</Text>
        </TouchableOpacity>
        <View style={styles.profileStats}>
          <View style={styles.profileStat}>
            <Text style={styles.profileStatValue}>4.9</Text>
            <Text style={styles.profileStatLabel}>App rating</Text>
          </View>
          <View style={styles.profileDivider} />
          <View style={styles.profileStat}>
            <Text style={styles.profileStatValue}>63</Text>
            <Text style={styles.profileStatLabel}>Total deliveries</Text>
          </View>
        </View>
      </View>

      {accountSections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionCard}>
            {section.items.map((item, index) => (
              <View key={item.label} style={[styles.detailRow, index !== section.items.length - 1 && styles.detailRowBorder]}>
                <Text style={styles.detailLabel}>{item.label}</Text>
                <Text style={styles.detailValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      <MenuRow
        icon="map-marker-multiple-outline"
        title="Saved places"
        subtitle="Home, office, warehouse and favorite customer drop-offs"
        trailingLabel="3 saved"
      />
      <MenuRow
        icon="account-edit-outline"
        title="Profile editing"
        subtitle="Update business name, contact details and notification settings"
        onPress={() => router.push('/profile-edit')}
      />
      <MenuRow
        icon="headset"
        title="Support center"
        subtitle="Chat with support, call dispatch or review safety guidance"
        onPress={() => router.push('/support-center')}
      />
      <MenuRow
        icon="shield-check-outline"
        title="Policies"
        subtitle="Review terms, privacy and delivery protection policies"
      />

      <PrimaryButton label="Sign out" variant="dark" icon="logout" onPress={() => router.replace('/login')} style={styles.logoutButton} />
    </CargoScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 20,
  },
  profileCard: {
    backgroundColor: cargoTheme.colors.darkSurface,
    borderRadius: 28,
    padding: 22,
    alignItems: 'center',
    marginBottom: 22,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileMeta: {
    fontSize: 13,
    color: '#D7E1EA',
    marginBottom: 12,
  },
  editProfileButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 16,
  },
  editProfileText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  profileStats: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    paddingVertical: 14,
  },
  profileStat: {
    flex: 1,
    alignItems: 'center',
  },
  profileStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D7E1EA',
  },
  profileDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: cargoTheme.colors.text,
    marginBottom: 10,
  },
  sectionCard: {
    backgroundColor: cargoTheme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    paddingHorizontal: 16,
  },
  detailRow: {
    paddingVertical: 14,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: cargoTheme.colors.subtext,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '800',
    color: cargoTheme.colors.text,
  },
  logoutButton: {
    marginTop: 8,
  },
});
