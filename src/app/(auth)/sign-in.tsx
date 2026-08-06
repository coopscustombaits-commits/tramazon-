import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { SocialSignIn } from '@/components/social-sign-in';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage, isCancellation } from '@/lib/auth/errors';

export default function SignInScreen() {
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle, signInWithApple } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'email' | 'google' | 'apple' | null>(null);

  async function handleEmailSignIn() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError(null);
    setBusy('email');
    try {
      await signInWithEmail(email, password);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function runSocialSignIn(provider: 'google' | 'apple') {
    setError(null);
    setBusy(provider);
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithApple();
      }
    } catch (caught) {
      if (!isCancellation(caught)) {
        Alert.alert('Sign-in failed', authErrorMessage(caught));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen scroll avoidKeyboard>
      <View style={styles.form}>
        <Text style={styles.heading}>Welcome back</Text>

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />

        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          secure
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleEmailSignIn}
          error={error}
        />

        <Link href="/(auth)/forgot-password" style={styles.forgot}>
          <Text style={styles.forgotText}>Forgot your password?</Text>
        </Link>

        <Button
          label="Log in"
          onPress={handleEmailSignIn}
          loading={busy === 'email'}
          disabled={busy !== null}
        />

        <SocialSignIn
          onGoogle={() => runSocialSignIn('google')}
          onApple={() => runSocialSignIn('apple')}
          busy={busy === 'email' ? null : busy}
          disabled={busy !== null}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>New here?</Text>
          <Button
            label="Create an account"
            variant="ghost"
            fullWidth={false}
            onPress={() => router.replace('/(auth)/sign-up')}
            disabled={busy !== null}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  heading: {
    ...Typography.title,
  },
  forgot: {
    alignSelf: 'flex-start',
  },
  forgotText: {
    ...Typography.caption,
    color: Colors.link,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  footerText: {
    ...Typography.caption,
  },
});
