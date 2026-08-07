import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SocialSignIn } from '@/components/social-sign-in';
import { Button } from '@/components/ui/button';
import { Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage, isCancellation } from '@/lib/auth/errors';

/** Landing screen: brand first, then the two ways in. */
export default function WelcomeScreen() {
  const Colors = useThemeColors();
  const styles = useStyles();
  const router = useRouter();
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);

  async function runSocialSignIn(provider: 'google' | 'apple') {
    setBusy(provider);
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithApple();
      }
      // On success the root navigator swaps to the app automatically.
    } catch (error) {
      if (!isCancellation(error)) {
        Alert.alert('Sign-in failed', authErrorMessage(error));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <LinearGradient
      colors={[Colors.primaryDark, Colors.primary, Colors.background]}
      locations={[0, 0.45, 1]}
      style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.hero}>
          <Text style={styles.brand}>COOP&apos;S</Text>
          <Text style={styles.brandStrong}>CUSTOM BAITS</Text>
          <Text style={styles.tagline}>
            Handmade baits, real catches, and the anglers who land them.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label="Create an account"
            onPress={() => router.push('/(auth)/sign-up')}
            disabled={busy !== null}
          />
          <Button
            label="Log in"
            variant="outline"
            onPress={() => router.push('/(auth)/sign-in')}
            disabled={busy !== null}
          />
          <SocialSignIn
            onGoogle={() => runSocialSignIn('google')}
            onApple={() => runSocialSignIn('apple')}
            busy={busy}
            disabled={busy !== null}
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const useStyles = makeStyles((Colors) => ({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  brand: {
    ...Typography.display,
    color: Colors.textInverse,
    letterSpacing: 6,
    fontSize: 28,
  },
  brandStrong: {
    ...Typography.display,
    color: Colors.textInverse,
    fontSize: 38,
    letterSpacing: 1,
  },
  tagline: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.85)',
    marginTop: Spacing.md,
    maxWidth: 300,
  },
  actions: {
    gap: Spacing.md,
  },
}));
