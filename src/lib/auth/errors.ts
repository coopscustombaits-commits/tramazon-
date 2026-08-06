import { FirebaseError } from 'firebase/app';

/**
 * Firebase auth error codes are not something to show a user. Map the ones we
 * actually hit to plain language, and fall back to something honest.
 */
const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/user-disabled': 'This account has been disabled. Contact support for help.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account already exists with that email.',
  'auth/weak-password': 'Please choose a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a minute and try again.',
  'auth/network-request-failed': 'Network problem. Check your connection and try again.',
  'auth/requires-recent-login': 'Please sign in again to finish this change.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/account-exists-with-different-credential':
    'You already have an account with that email. Sign in with the method you used before, then link this one from Settings.',
  'auth/operation-not-allowed':
    'That sign-in method isn’t enabled yet. (Enable it in Firebase console → Authentication → Sign-in method.)',
};

/** User-facing message for anything thrown by the auth layer. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return MESSAGES[error.code] ?? `Something went wrong (${error.code}).`;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

/** True when the user backed out of a social sign-in sheet — not a real error. */
export class SignInCancelledError extends Error {
  constructor() {
    super('Sign-in cancelled.');
    this.name = 'SignInCancelledError';
  }
}

export function isCancellation(error: unknown): boolean {
  return error instanceof SignInCancelledError;
}
