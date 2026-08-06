import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential, type UserCredential } from 'firebase/auth';
import { Platform } from 'react-native';

import { auth } from '@/lib/firebase';
import { SignInCancelledError } from '@/lib/auth/errors';

/**
 * Google sign-in via the native SDK. We exchange Google's ID token for a
 * Firebase credential — Firebase stays the single source of truth for identity.
 *
 * Requires a development build (this is a native module, so it does not run in
 * Expo Go). See docs/SETUP.md.
 */

let configured = false;

export function isGoogleSignInAvailable(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) && Platform.OS !== 'web';
}

function configure(): void {
  if (configured) return;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new Error(
      'Google Sign-In is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env.',
    );
  }
  GoogleSignin.configure({
    // Firebase validates the ID token against the *web* client ID on both
    // platforms — this is the one that must always be set.
    webClientId,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false,
    scopes: ['profile', 'email'],
  });
  configured = true;
}

export async function signInWithGoogle(): Promise<UserCredential> {
  configure();

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  let idToken: string | null;
  try {
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') {
      throw new SignInCancelledError();
    }
    idToken = response.data.idToken;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new SignInCancelledError();
    }
    throw error;
  }

  if (!idToken) {
    throw new Error('Google did not return an ID token. Check your OAuth client IDs.');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

/**
 * Google keeps its own session alongside Firebase's. Clearing it means the
 * next sign-in shows the account picker instead of silently reusing the last
 * account — which is what people expect after tapping "Log out".
 */
export async function signOutFromGoogle(): Promise<void> {
  if (!configured) return;
  try {
    await GoogleSignin.signOut();
  } catch {
    // Not signed in with Google, or the native module is unavailable.
  }
}
