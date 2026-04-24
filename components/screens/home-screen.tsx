import React from 'react';

import { SafePlatformScreen } from '@/components/screens/safe-platform-screen';

export default function HomeScreen() {
  return (
    <SafePlatformScreen
      screenName="Home"
      loadNative={() => require('./home-screen.native')}
      loadWeb={() => require('./home-screen.web')}
    />
  );
}
