import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ScreenLoader } from '@/components/ui/screen';
import { navigationHeader } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
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
  const { status } = useAuth();

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
        <Stack.Screen name="admin/review" options={{ title: 'Review Queue' }} />
      </Stack.Protected>
    </Stack>
  );
}
