import { getPersistedItem, setPersistedItem } from '@/lib/persistent-storage';

const KNOWN_ACCOUNT_KEY = 'doordrop.hasKnownAccount';
const LEGACY_APP_LAUNCH_KEY = 'doordrop.hasOpenedApp';
const LAST_LAUNCH_ROUTE_KEY = 'doordrop.lastLaunchRoute';
let hasKnownAccountInMemory = false;

export type LaunchState = 'new-user' | 'returning-user';
export type StoredLaunchRoute = '/home' | '/login';

export async function getLaunchState(): Promise<LaunchState> {
  if (hasKnownAccountInMemory) {
    return 'returning-user';
  }

  const hasKnownAccount = await getPersistedItem(KNOWN_ACCOUNT_KEY);
  const hasLegacyAppLaunch = await getPersistedItem(LEGACY_APP_LAUNCH_KEY);

  if (hasKnownAccount === 'true' || hasLegacyAppLaunch === 'true') {
    hasKnownAccountInMemory = true;
    return 'returning-user';
  }

  return 'new-user';
}

export async function markKnownAccount() {
  hasKnownAccountInMemory = true;

  await Promise.all([
    setPersistedItem(KNOWN_ACCOUNT_KEY, 'true'),
    setPersistedItem(LEGACY_APP_LAUNCH_KEY, 'true'),
  ]);
}

export async function getStoredLaunchRoute(): Promise<StoredLaunchRoute> {
  const storedRoute = await getPersistedItem(LAST_LAUNCH_ROUTE_KEY);

  if (storedRoute === '/home' || storedRoute === '/login') {
    return storedRoute;
  }

  const launchState = await getLaunchState();
  return launchState === 'returning-user' ? '/home' : '/login';
}

export async function setStoredLaunchRoute(route: StoredLaunchRoute) {
  if (route === '/home') {
    await markKnownAccount();
  }

  await setPersistedItem(LAST_LAUNCH_ROUTE_KEY, route);
}
