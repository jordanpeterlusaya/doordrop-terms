import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { NativeModules, Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyD97lPfGR0Yf0z-WfCl1L_rYH9HPlgE3s0',
  authDomain: 'efootball-app-9d175.firebaseapp.com',
  projectId: 'efootball-app-9d175',
  storageBucket: 'efootball-app-9d175.firebasestorage.app',
  messagingSenderId: '729242246964',
  appId: '1:729242246964:web:bdb35a59a681a4a7420f61',
  measurementId: 'G-G3XDE8M7L5',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

function getFirebasePersistenceStorage() {
  if (Platform.OS === 'web') {
    return undefined;
  }

  const nativeModules = NativeModules as Record<string, unknown>;

  if (!nativeModules.RNCAsyncStorage) {
    return undefined;
  }

  return AsyncStorage;
}

export const auth = (() => {
  if (Platform.OS === 'web') {
    return firebaseAuth.getAuth(firebaseApp);
  }

  try {
    const authModule = firebaseAuth as typeof firebaseAuth & {
      getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
    };
    const persistenceStorage = getFirebasePersistenceStorage();

    return firebaseAuth.initializeAuth(firebaseApp, {
      persistence: persistenceStorage ? authModule.getReactNativePersistence?.(persistenceStorage) : undefined,
    });
  } catch {
    return firebaseAuth.getAuth(firebaseApp);
  }
})();

export const db = getFirestore(firebaseApp);
