import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { SocialSignIn } from '@/components/social-sign-in';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage, isCancellation } from '@/lib/auth/errors';
import { isUsernameAvailable, validateUsername } from '@/lib/db/users';

const MIN_PASSWORD_LENGTH = 8;

type FieldErrors = {
  username?: string;
  email?: string;
  password?: string;
};

export default function SignUpScreen() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle, signInWithApple } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [favoriteSpecies, setFavoriteSpecies] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<'email' | 'google' | 'apple' | null>(null);

  async function handleSignUp() {
    const nextErrors: FieldErrors = {};

    const usernameError = validateUsername(username);
    if (usernameError) nextErrors.username = usernameError;
    if (!email.trim()) nextErrors.email = 'Enter your email address.';
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setBusy('email');
    try {
      // Checked up front so people don't create an account and then get told
      // their name is taken. The transaction in createUserProfile is what
      // actually guarantees uniqueness.
      if (!(await isUsernameAvailable(username))) {
        setErrors({ username: 'That username is already taken.' });
        return;
      }
      await signUpWithEmail({
        email,
        password,
        username: username.trim(),
        favoriteSpecies: favoriteSpecies.trim() || undefined,
      });
    } catch (caught) {
      const message = authErrorMessage(caught);
      // Route the message to the field it belongs to when we can tell.
      if (message.toLowerCase().includes('email')) {
        setErrors({ email: message });
      } else if (message.toLowerCase().includes('username')) {
        setErrors({ username: message });
      } else if (message.toLowerCase().includes('password')) {
        setErrors({ password: message });
      } else {
        Alert.alert('Could not create account', message);
      }
    } finally {
      setBusy(null);
    }
  }

  async function runSocialSignIn(provider: 'google' | 'apple') {
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
        <Text style={styles.heading}>Join the crew</Text>
        <Text style={styles.subheading}>
          Share your catches, shop the baits, and see what everyone else is landing.
        </Text>

        <TextField
          label="Username"
          value={username}
          onChangeText={setUsername}
          placeholder="riverrat"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          error={errors.username}
          hint="Letters, numbers, and underscores. This is how others see you."
        />

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          error={errors.email}
        />

        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.password}
        />

        <TextField
          label="Favorite species (optional)"
          value={favoriteSpecies}
          onChangeText={setFavoriteSpecies}
          placeholder="Largemouth bass"
          autoCapitalize="words"
          returnKeyType="go"
          onSubmitEditing={handleSignUp}
        />

        <Button
          label="Create account"
          onPress={handleSignUp}
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
          <Text style={styles.footerText}>Already have an account?</Text>
          <Button
            label="Log in"
            variant="ghost"
            fullWidth={false}
            onPress={() => router.replace('/(auth)/sign-in')}
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
  subheading: {
    ...Typography.body,
    color: Typography.caption.color,
    marginTop: -Spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    ...Typography.caption,
  },
});
