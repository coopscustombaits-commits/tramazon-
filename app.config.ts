import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * App configuration for Coop's Custom Baits.
 *
 * Secrets/IDs come from environment variables so the same code can build
 * against a dev Firebase project and a production one. See `.env.example`
 * and `docs/SETUP.md`.
 */

const BUNDLE_ID = 'com.coopscustombaits.app';

/**
 * Google Sign-In on iOS needs a URL scheme that is the iOS OAuth client ID
 * with its domain reversed:
 *   1234-abcdef.apps.googleusercontent.com
 *   -> com.googleusercontent.apps.1234-abcdef
 */
function iosGoogleUrlScheme(): string {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!clientId) {
    // Placeholder so `expo prebuild` still succeeds before Google is configured.
    return 'com.googleusercontent.apps.PLACEHOLDER';
  }
  return `com.googleusercontent.apps.${clientId.replace('.apps.googleusercontent.com', '')}`;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Coop's Custom Baits",
  slug: 'coops-custom-baits',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'coopscustombaits',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: true,
    usesAppleSignIn: true,
    infoPlist: {
      // Required so iOS lets us open the Shopify checkout in Safari / the
      // in-app browser and come back.
      LSApplicationQueriesSchemes: ['https'],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#2E4A3D',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-apple-authentication',
    'expo-web-browser',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F7F3EC',
        image: './assets/images/splash-icon.png',
        imageWidth: 180,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          "Coop's Custom Baits uses your photos so you can share pictures of your catch.",
        cameraPermission:
          "Coop's Custom Baits uses your camera so you can snap a picture of your catch.",
      },
    ],
    [
      'expo-notifications',
      {
        color: '#2E4A3D',
      },
    ],
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme: iosGoogleUrlScheme(),
      },
    ],
  ],
  experiments: {
    reactCompiler: true,
  },
  extra: {
    ...config.extra,
    router: {},
    eas: {
      // `eas init` fills this in; leaving it here documents where it lands.
      projectId: process.env.EAS_PROJECT_ID,
    },
    // The uid of the owner account that can approve/reject posts. This is a
    // convenience for the client UI only — the real check lives in
    // firestore.rules (`/admins/{uid}` documents).
    adminUid: process.env.EXPO_PUBLIC_ADMIN_UID,
  },
});
