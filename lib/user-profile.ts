import { doc, getDoc, increment, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase';

export type UserProfile = {
  uid: string;
  fullName: string;
  email?: string;
  phoneNumber: string;
  phoneVerified: boolean;
  city?: string;
  defaultPayment?: string;
  notificationPreferences?: {
    orderUpdates?: boolean;
    promotions?: boolean;
  };
  appOpenCount?: number;
  lastActiveAt?: unknown;
  lastActiveLatitude?: number;
  lastActiveLongitude?: number;
  latestPushToken?: string;
  pushTokenPlatform?: string;
  pushTokenUpdatedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function userProfileRef(uid: string) {
  return doc(db, 'users', uid);
}

export async function getUserProfile(uid: string) {
  const snapshot = await getDoc(userProfileRef(uid));

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as UserProfile;
}

export async function upsertUserProfile(
  profile: Pick<UserProfile, 'uid' | 'fullName' | 'phoneNumber' | 'phoneVerified'> & {
    email?: string;
    city?: string;
    defaultPayment?: string;
    notificationPreferences?: UserProfile['notificationPreferences'];
  }
) {
  await setDoc(
    userProfileRef(profile.uid),
    {
      ...profile,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function recordUserAppOpen(input: {
  uid: string;
  fullName: string;
  phoneNumber: string;
  phoneVerified: boolean;
  email?: string;
  latitude?: number;
  longitude?: number;
}) {
  await setDoc(
    userProfileRef(input.uid),
    {
      uid: input.uid,
      fullName: input.fullName,
      email: input.email?.trim().toLowerCase() || '',
      phoneNumber: input.phoneNumber,
      phoneVerified: input.phoneVerified,
      appOpenCount: increment(1),
      lastActiveAt: serverTimestamp(),
      lastActiveLatitude: input.latitude,
      lastActiveLongitude: input.longitude,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function recordUserPushToken(input: {
  uid: string;
  token: string;
  platform: string;
}) {
  await setDoc(
    userProfileRef(input.uid),
    {
      latestPushToken: input.token,
      pushTokenPlatform: input.platform,
      pushTokenUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}
