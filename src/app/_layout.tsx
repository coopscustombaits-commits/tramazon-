import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/error-boundary';
import { ScreenLoader } from '@/components/ui/screen';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { navigationHeader } from '@/constants/theme';
import { ThemeProvider, useTheme, useThemeColors } from '@/constants/theme-context';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import { BlockedProvider } from '@/lib/db/blocked-context';
import { CartProvider } from '@/lib/shopify/cart-context';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Theme sits outermost so even the error screen is themed. */}
        <ThemeProvider>
          <ErrorBoundary>
            <AuthProvider>
              <BlockedProvider>
                <CartProvider>
                  <ThemedStatusBar />
                  <RootNavigator />
                </CartProvider>
              </BlockedProvider>
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Status bar icons have to invert with the theme or they vanish. */
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

/**
 * Routing is driven entirely by auth status — no imperative redirects, so
 * there's no window where a signed-out user can see a signed-in screen.
 *
 *   signed-out    -> (auth) group
 *   needs-profile -> username setup only
 *   signed-in     -> the app
 */
function RootNavigator() {
  const colors = useThemeColors();
  const { status, user } = useAuth();

  // Register for push and handle notification taps once signed in.
  usePushNotifications(status === 'signed-in' ? (user?.uid ?? null) : null);

  useEffect(() => {
    if (status !== 'loading') {
      void SplashScreen.hideAsync();
    }
  }, [status]);

  if (status === 'loading') {
    return <ScreenLoader />;
  }

  return (
    <Stack screenOptions={navigationHeader(colors)}>
      <Stack.Protected guard={status === 'signed-out'}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={status === 'needs-profile'}>
        <Stack.Screen
          name="complete-profile"
          options={{ headerShown: false, gestureEnabled: false }}
        />
      </Stack.Protected>

      <Stack.Protected guard={status === 'signed-in'}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
        <Stack.Screen name="settings/edit-profile" options={{ title: 'Edit Profile' }} />
        <Stack.Screen name="settings/about" options={{ title: 'About' }} />
        <Stack.Screen name="settings/contact" options={{ title: 'Contact & Support' }} />
        <Stack.Screen name="settings/notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="settings/privacy" options={{ title: 'Privacy & Data' }} />
        <Stack.Screen name="settings/blocked" options={{ title: 'Blocked Anglers' }} />
        <Stack.Screen name="admin/review" options={{ title: 'Review Queue' }} />
        <Stack.Screen name="admin/announce" options={{ title: 'Announcement' }} />
        <Stack.Screen name="admin/reports" options={{ title: 'Reports' }} />
        <Stack.Screen name="post/[id]" options={{ title: 'Catch' }} />
        <Stack.Screen name="product/[handle]" options={{ title: 'Product' }} />
        <Stack.Screen name="cart" options={{ title: 'Cart' }} />
        <Stack.Screen name="wishlist" options={{ title: 'Wishlist' }} />
        <Stack.Screen name="orders" options={{ title: 'Your Orders' }} />
        <Stack.Screen name="notifications" options={{ title: 'Activity' }} />
        <Stack.Screen name="user/[uid]" options={{ title: 'Angler' }} />
        <Stack.Screen name="search" options={{ title: 'Search' }} />
        <Stack.Screen name="messages/index" options={{ title: 'Messages' }} />
        <Stack.Screen name="messages/[id]" options={{ title: 'Message' }} />
        <Stack.Screen name="species/index" options={{ title: 'Species' }} />
        <Stack.Screen name="species/[slug]" options={{ title: 'Species' }} />
      </Stack.Protected>
    </Stack>
  );
}
