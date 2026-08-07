import { Stack } from 'expo-router';

import { navigationHeader } from '@/constants/theme';
import { useThemeColors } from '@/constants/theme-context';

export default function AuthLayout() {
  const colors = useThemeColors();
  return (
    <Stack screenOptions={{ ...navigationHeader(colors), headerBackTitle: 'Back' }}>
      {/* First screen listed is where signed-out users land. */}
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ title: 'Log In' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Create Account' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset Password' }} />
    </Stack>
  );
}
