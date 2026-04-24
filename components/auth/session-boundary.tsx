import type { ReactNode } from 'react';

import { AuthProvider } from '@/providers/auth-provider';
import { NotificationProvider } from '@/providers/notification-provider';

export function AuthSessionBoundary({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

export function AuthNotificationBoundary({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </AuthProvider>
  );
}
