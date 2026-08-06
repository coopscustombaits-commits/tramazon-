import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { OAuthProvider, signInWithCredential, type UserCredential } from 'firebase/auth';
import { Platform } from 'react-native';

import { auth } from '@/lib/firebase';
import { SignInCancelledError } from '@/lib/auth/errors';

/**
 * Sign in with Apple. Apple is required by App Store review whenever an app
 * offers other third-party sign-in options, so this is not optional for us.
 *
 * The nonce dance matters: Apple wants the SHA-256 hash of a nonce in the
 * request, and Firebase wants the original unhashed value to verify the
 * returned token. Sending the same string to both fails with
 * `auth/invalid-credential`.
 */

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

function randomNonce(length = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._';
  const bytes = Crypto.getRandomBytes(length);
  return Array.from(bytes)
    .map((byte) => charset[byte % charset.length])
    .join('');
}

/**
 * Apple only sends the user's name on the *first* authorization for an app.
 * We return it so the caller can seed a username; after that it's gone for
 * good unless the user removes the app from their Apple ID settings.
 */
export type AppleSignInResult = {
  credential: UserCredential;
  fullName: string | null;
};

export async function signInWithApple(): Promise<AppleSignInResult> {
  const rawNonce = randomNonce();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  let appleCredential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: string }).code === 'ERR_REQUEST_CANCELED'
    ) {
      throw new SignInCancelledError();
    }
    throw error;
  }

  if (!appleCredential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  const provider = new OAuthProvider('apple.com');
  const firebaseCredential = provider.credential({
    idToken: appleCredential.identityToken,
    rawNonce,
  });

  const fullName = [
    appleCredential.fullName?.givenName,
    appleCredential.fullName?.familyName,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    credential: await signInWithCredential(auth, firebaseCredential),
    fullName: fullName.length > 0 ? fullName : null,
  };
}
