import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { CargoHeader, CargoScreen, MenuRow, PrimaryButton } from '@/components/cargo-ui';
import { cargoTheme, menuSections } from '@/constants/cargo-theme';

export default function MenuScreen() {
  const router = useRouter();

  return (
    <CargoScreen contentContainerStyle={styles.content}>
      <CargoHeader
        title="Menu"
        subtitle="Navigate through booking, tracking and account tools."
        leftAction="close"
        onLeftPress={() => router.back()}
      />

      <View style={styles.profileCard}>
        <View style={styles.profileTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>DS</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>DoorDrop Studio</Text>
            <Text style={styles.profileMeta}>Business sender • 12 active deliveries this month</Text>
          </View>
          <TouchableOpacity style={styles.profileAction}>
            <MaterialCommunityIcons name="bell-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <Text style={styles.profileText}>
          Manage parcel drops, cargo vehicles and live tracking from one logistics dashboard.
        </Text>
      </View>

      {menuSections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item) => (
            <MenuRow
              key={item.title}
              icon={item.icon}
              title={item.title}
              subtitle={item.subtitle}
              onPress={() => router.push(item.route)}
            />
          ))}
        </View>
      ))}

      <View style={styles.helpCard}>
        <Text style={styles.helpTitle}>Need dispatch support?</Text>
        <Text style={styles.helpText}>
          Get help with pricing, route planning, driver matching and delivery issues at any time.
        </Text>
        <PrimaryButton label="Open account & support" variant="secondary" onPress={() => router.push('/account')} />
      </View>

      <PrimaryButton label="Sign out" variant="dark" icon="logout" onPress={() => router.replace('/login')} />
    </CargoScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
  profileCard: {
    backgroundColor: cargoTheme.colors.darkSurface,
    borderRadius: 28,
    padding: 18,
    marginBottom: 24,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileCopy: {
    flex: 1,
    marginRight: 12,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  profileMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: '#D6E0EA',
  },
  profileAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#D6E0EA',
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
  helpCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginTop: 8,
    marginBottom: 16,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: cargoTheme.colors.primaryDark,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    lineHeight: 20,
    color: cargoTheme.colors.primaryDark,
    marginBottom: 14,
  },
});
