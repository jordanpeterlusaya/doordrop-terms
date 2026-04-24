import React from 'react';

import { SafePlatformScreen } from '@/components/screens/safe-platform-screen';

export default function TrackOrderScreen() {
  return (
    <SafePlatformScreen
      screenName="Track order"
      loadNative={() => require('./track-order-screen.native')}
      loadWeb={() => require('./track-order-screen.web')}
    />
  );
}
