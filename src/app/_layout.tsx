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
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import { CartProvider } from '@/lib/shopify/cart-context';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Outside the providers, so it still renders if one of them throws. */}
        <ErrorBoundary>
          <AuthProvider>
            <CartProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </CartProvider>
          </AuthProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
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
    <Stack screenOptions={navigationHeader}>
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
        <Stack.Screen name="admin/review" options={{ title: 'Review Queue' }} />
        <Stack.Screen name="admin/announce" options={{ title: 'Announcement' }} />
        <Stack.Screen name="post/[id]" options={{ title: 'Catch' }} />
        <Stack.Screen name="product/[handle]" options={{ title: 'Product' }} />
        <Stack.Screen name="cart" options={{ title: 'Cart' }} />
        <Stack.Screen name="wishlist" options={{ title: 'Wishlist' }} />
        <Stack.Screen name="orders" options={{ title: 'Your Orders' }} />
        <Stack.Screen name="notifications" options={{ title: 'Activity' }} />
        <Stack.Screen name="user/[uid]" options={{ title: 'Angler' }} />
      </Stack.Protected>
    </Stack>
  );
}
