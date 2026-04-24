export const firebaseConfig = {
  apiKey: 'AIzaSyD97lPfGR0Yf0z-WfCl1L_rYH9HPlgE3s0',
  authDomain: 'efootball-app-9d175.firebaseapp.com',
  projectId: 'efootball-app-9d175',
  storageBucket: 'efootball-app-9d175.firebasestorage.app',
  messagingSenderId: '729242246964',
  appId: '1:729242246964:web:bdb35a59a681a4a7420f61',
  measurementId: 'G-G3XDE8M7L5',
};

export const adminWebsiteConfig = {
  appName: 'DoorDrop Admin Dashboards',
  projectLabel: 'efootball-app-9d175',
  currencyLabel: 'TZS',
  // Simple admin sign-in:
  // - Any Firebase email/password account from this project can open all dashboards.
  // - These legacy access settings are no longer used for login gating.
  accessControl: {
    assignments: {},
    fallbackRole: '',
  },
};
