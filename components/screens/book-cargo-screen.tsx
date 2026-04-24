import React from 'react';

import { SafePlatformScreen } from '@/components/screens/safe-platform-screen';

export default function BookCargoScreen() {
  return (
    <SafePlatformScreen
      screenName="Book cargo"
      loadNative={() => require('./book-cargo-screen.native')}
      loadWeb={() => require('./book-cargo-screen.web')}
    />
  );
}
