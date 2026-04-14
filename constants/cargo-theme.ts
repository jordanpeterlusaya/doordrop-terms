import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type CargoIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];
export type AppTabKey = 'home' | 'track' | 'history' | 'account';
export type FlowType = 'parcel' | 'cargo';
export type ParcelScope = 'city' | 'outside';

export const cargoTheme = {
  colors: {
    primary: '#16A34A',
    primaryDark: '#14532D',
    primarySoft: '#DCFCE7',
    ink: '#0F172A',
    text: '#111827',
    subtext: '#64748B',
    line: '#E2E8F0',
    surface: '#FFFFFF',
    canvas: '#F4F7F6',
    card: '#F8FAFC',
    success: '#22C55E',
    warning: '#EA580C',
    warningSoft: '#FFF7ED',
    info: '#2563EB',
    infoSoft: '#EFF6FF',
    darkSurface: '#0F172A',
  },
  radius: {
    lg: 22,
    xl: 28,
    pill: 999,
  },
};

export const bottomTabs: {
  key: AppTabKey;
  label: string;
  icon: CargoIcon;
  route: '/home' | '/track-order' | '/history' | '/account';
}[] = [
  { key: 'home', label: 'Home', icon: 'home-variant', route: '/home' },
  { key: 'track', label: 'Track', icon: 'map-marker-path', route: '/track-order' },
  { key: 'history', label: 'History', icon: 'history', route: '/history' },
  { key: 'account', label: 'Account', icon: 'account-circle-outline', route: '/account' },
];

export const menuSections: {
  title: string;
  items: {
    title: string;
    subtitle: string;
    icon: CargoIcon;
    route: '/home' | '/send-parcel' | '/book-cargo' | '/track-order' | '/history' | '/account';
  }[];
}[] = [
  {
    title: 'Delivery tools',
    items: [
      {
        title: 'Send parcel',
        subtitle: 'Door-to-door parcel delivery inside or outside the city',
        icon: 'package-variant-closed',
        route: '/send-parcel',
      },
      {
        title: 'Book cargo',
        subtitle: 'Request the right cargo carrier from bike to truck',
        icon: 'truck-fast-outline',
        route: '/book-cargo',
      },
      {
        title: 'Track orders',
        subtitle: 'See live status, driver progress and ETA',
        icon: 'map-marker-path',
        route: '/track-order',
      },
    ],
  },
  {
    title: 'Your account',
    items: [
      {
        title: 'Home dashboard',
        subtitle: 'Back to your main booking screen',
        icon: 'view-dashboard-outline',
        route: '/home',
      },
      {
        title: 'Order history',
        subtitle: 'Previous deliveries, invoices and repeats',
        icon: 'history',
        route: '/history',
      },
      {
        title: 'Account & settings',
        subtitle: 'Profile, payments, saved places and support',
        icon: 'account-circle-outline',
        route: '/account',
      },
    ],
  },
];

export const parcelScopes: {
  key: ParcelScope;
  label: string;
  subtitle: string;
}[] = [
  {
    key: 'city',
    label: 'In city',
    subtitle: 'Best for fast urban deliveries with short ETA',
  },
  {
    key: 'outside',
    label: 'Outside city',
    subtitle: 'Long-distance deliveries with planned dispatch',
  },
];

export const parcelPackages: {
  key: string;
  title: string;
  subtitle: string;
  icon: CargoIcon;
}[] = [
  {
    key: 'document',
    title: 'Documents',
    subtitle: 'Contracts, letters and paperwork',
    icon: 'file-document-outline',
  },
  {
    key: 'box',
    title: 'Small box',
    subtitle: 'Gifts, gadgets or daily essentials',
    icon: 'archive-outline',
  },
  {
    key: 'fragile',
    title: 'Fragile item',
    subtitle: 'Handled carefully with added notes',
    icon: 'glass-fragile',
  },
];

export const cargoVehicles: {
  key: string;
  title: string;
  capacity: string;
  eta: string;
  price: string;
  icon: CargoIcon;
  accentColor: string;
  accentBg: string;
}[] = [
  {
    key: 'kirikuu',
    title: 'Kirikuu',
    capacity: 'Up to 30 kg',
    eta: '10-15 min',
    price: 'TZS 4,500',
    icon: 'motorbike',
    accentColor: '#EA580C',
    accentBg: '#FFF7ED',
  },
  {
    key: 'pickup',
    title: 'Pickup',
    capacity: 'Up to 350 kg',
    eta: '15-20 min',
    price: 'TZS 18,000',
    icon: 'car-pickup',
    accentColor: '#2563EB',
    accentBg: '#EFF6FF',
  },
  {
    key: 'toyo',
    title: 'Toyo',
    capacity: 'Up to 2 tons',
    eta: '25-40 min',
    price: 'TZS 55,000',
    icon: 'truck-outline',
    accentColor: '#15803D',
    accentBg: '#DCFCE7',
  },
];

export const historyOrders = [
  {
    id: 'DD-20481',
    type: 'Cargo van',
    route: 'Mlimani City to Kariakoo',
    status: 'Delivered',
    amount: 'TZS 32,000',
    time: 'Today, 11:40',
  },
  {
    id: 'DD-20462',
    type: 'In-city parcel',
    route: 'Posta to Masaki',
    status: 'Delivered',
    amount: 'TZS 6,500',
    time: 'Yesterday, 18:10',
  },
  {
    id: 'DD-20412',
    type: 'Pickup cargo',
    route: 'Mbezi to Tegeta',
    status: 'Canceled',
    amount: 'TZS 18,000',
    time: 'Apr 10, 09:15',
  },
];

export const accountSections = [
  {
    title: 'Profile',
    items: [
      { label: 'Business profile', value: 'DoorDrop Studio' },
      { label: 'Primary phone', value: '+255 742 000 111' },
      { label: 'Default payment', value: 'Cash on delivery' },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { label: 'Saved addresses', value: '3 places' },
      { label: 'Notifications', value: 'Orders, driver ETA, promos' },
      { label: 'Support', value: '24/7 in-app help' },
    ],
  },
];

export const trackingSteps = [
  { title: 'Order confirmed', note: 'A driver has been matched to your request.' },
  { title: 'Driver on the way', note: 'Estimated arrival to pickup in 8 minutes.' },
  { title: 'Picked up', note: 'Cargo is secured and route is active.' },
  { title: 'Approaching destination', note: 'Delivery is almost complete.' },
];
