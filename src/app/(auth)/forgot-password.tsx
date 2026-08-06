import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { sendPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSend() {
    if (!email.trim()) {
      setError('Enter the email address on your account.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (caught) {
      // Deliberately not distinguishing "no such user" here — that would let
      // anyone check which emails have accounts.
      if (caught instanceof Error && caught.message.includes('auth/user-not-found')) {
        setSent(true);
      } else {
        setError(authErrorMessage(caught));
      }
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Screen>
        <View style={styles.confirmation}>
          <Text style={styles.heading}>Check your email</Text>
          <Text style={styles.body}>
            If an account exists for {email.trim()}, we&apos;ve sent a link to reset the
            password. It can take a minute to arrive — check spam too.
          </Text>
          <Button label="Back to log in" onPress={() => router.replace('/(auth)/sign-in')} />
          <Button
            label="Send it again"
            variant="ghost"
            onPress={() => setSent(false)}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll avoidKeyboard>
      <View style={styles.form}>
        <Text style={styles.heading}>Reset your password</Text>
        <Text style={styles.body}>
          Enter the email on your account and we&apos;ll send you a reset link.
        </Text>

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="go"
          onSubmitEditing={handleSend}
          error={error}
        />

        <Button label="Send reset link" onPress={handleSend} loading={busy} />

        <Text style={styles.note}>
          Signed up with Google or Apple? Those accounts don&apos;t have a password here —
          use that button on the log-in screen instead.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  confirmation: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  heading: {
    ...Typography.title,
  },
  body: {
    ...Typography.body,
    color: Colors.textMuted,
  },
  note: {
    ...Typography.caption,
  },
});
