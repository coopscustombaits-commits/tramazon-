import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { Platform } from 'react-native';

/**
 * Firebase bootstrap.
 *
 * Values come from EXPO_PUBLIC_* env vars (see .env.example). They are baked
 * into the bundle, which is fine — Firebase web config is public by design and
 * access is controlled by security rules.
 */

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and fill in your Firebase config ` +
        `(see docs/SETUP.md), then restart the dev server with \`npx expo start -c\`.`,
    );
  }
  return value;
}

const firebaseConfig = {
  apiKey: requireEnv(
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  ),
  authDomain: requireEnv(
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  ),
  projectId: requireEnv(
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  ),
  storageBucket: requireEnv(
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  ),
  messagingSenderId: requireEnv(
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  ),
  appId: requireEnv(
    'EXPO_PUBLIC_FIREBASE_APP_ID',
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  ),
};

/**
 * `getReactNativePersistence` only exists in the React Native build of
 * `@firebase/auth`. Metro resolves to that build at runtime, but the types
 * published under the `firebase/auth` entry point are the web ones, so it is
 * not visible to TypeScript. Reach for it defensively.
 */
type GetReactNativePersistence = (storage: unknown) => Persistence;

function reactNativePersistence(): Persistence | undefined {
  const authModule = firebaseAuth as unknown as {
    getReactNativePersistence?: GetReactNativePersistence;
  };
  return authModule.getReactNativePersistence?.(AsyncStorage);
}

function createApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

function createAuth(app: FirebaseApp): Auth {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }
  const persistence = reactNativePersistence();
  if (!persistence) {
    // Sessions would not survive an app restart, which is a bad enough
    // experience that we want to know about it rather than silently ship it.
    console.warn(
      '[firebase] React Native auth persistence unavailable; ' +
        'sign-in will not persist across app restarts.',
    );
  }
  try {
    return initializeAuth(app, {
      persistence: persistence ?? browserLocalPersistence,
    });
  } catch {
    // Already initialized (Fast Refresh re-evaluated this module).
    return getAuth(app);
  }
}

function createFirestore(app: FirebaseApp): Firestore {
  if (Platform.OS === 'web') {
    return getFirestore(app);
  }
  try {
    // Long polling is the reliable transport for the Firestore JS SDK on React
    // Native; auto-detection can produce "could not reach backend" stalls.
    return initializeFirestore(app, { experimentalForceLongPolling: true });
  } catch {
    return getFirestore(app);
  }
}

export const app = createApp();
export const auth = createAuth(app);
export const db = createFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
