export function getFirebaseAuthErrorMessage(code?: string) {
  switch (code) {
    case 'auth/app-not-authorized':
      return 'This app is not authorized for Firebase Authentication with the current API key or domain configuration.';
    case 'auth/invalid-api-key':
      return 'The Firebase API key is invalid. Check the Firebase app configuration.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase Console.';
    case 'auth/unauthorized-domain':
      return 'This app domain is not authorized in Firebase Authentication. Add the required domain in Firebase Console > Authentication > Settings.';
    case 'auth/timeout':
      return 'The verification request timed out. Check your connection and try again.';
    case 'auth/email-already-in-use':
      return 'That email is already in use. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support if this looks wrong.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Your email or password is incorrect.';
    case 'auth/weak-password':
      return 'Use a stronger password with at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts right now. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/invalid-phone-number':
      return 'Enter a valid phone number with the correct country code.';
    case 'auth/missing-phone-number':
      return 'Phone number is required before we can send the OTP.';
    case 'auth/captcha-check-failed':
      return 'The verification challenge failed or expired. Try requesting the OTP again.';
    case 'auth/invalid-app-credential':
    case 'auth/missing-app-credential':
      return 'Firebase could not validate this app for phone sign-in. Retry the OTP request. If it persists, check the Firebase phone-auth setup.';
    case 'auth/app-deleted':
      return 'The Firebase app instance is unavailable. Restart the app and try again.';
    case 'auth/invalid-verification-code':
      return 'That OTP code is invalid. Check the SMS and try again.';
    case 'auth/code-expired':
    case 'auth/session-expired':
      return 'This OTP has expired. Request a new one and try again.';
    case 'auth/quota-exceeded':
      return 'SMS quota exceeded for now. Please try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export function getFirebasePasswordResetErrorMessage(code?: string) {
  switch (code) {
    case 'auth/missing-email':
      return 'Enter the email address linked to your account.';
    case 'auth/user-not-found':
      return 'We could not find an account with that email address.';
    default:
      return getFirebaseAuthErrorMessage(code);
  }
}

export function getFirebasePasswordChangeErrorMessage(code?: string) {
  switch (code) {
    case 'auth/requires-recent-login':
      return 'For security, confirm your current password and try again.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-mismatch':
      return 'Your current password is incorrect.';
    case 'auth/missing-email':
      return 'This account is missing an email address. Use the reset email option or sign in again.';
    case 'auth/user-token-expired':
      return 'Your session expired. Sign in again before changing the password.';
    default:
      return getFirebaseAuthErrorMessage(code);
  }
}

export function getFirebaseDataErrorMessage(code?: string, fallback = 'Something went wrong. Please try again.') {
  switch (code) {
    case 'permission-denied':
    case 'firestore/permission-denied':
      return 'Firebase blocked this action. Check your Firestore rules and make sure the signed-in user can read and write orders.';
    case 'unauthenticated':
    case 'firestore/unauthenticated':
      return 'Sign in again before trying this action.';
    case 'unavailable':
    case 'firestore/unavailable':
    case 'network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'failed-precondition':
    case 'firestore/failed-precondition':
      return 'Firestore is not ready for this action yet. Confirm the database exists and required indexes are ready.';
    default:
      return fallback;
  }
}
