import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing, Typography } from '@/constants/theme';
import { makeStyles } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { isUsernameAvailable, validateUsername } from '@/lib/db/users';

/**
 * Shown when there's a Firebase account but no profile document yet — i.e.
 * someone just signed up with Google or Apple, or an email sign-up failed
 * partway through. Signing out is the only way past it without finishing.
 */
export default function CompleteProfileScreen() {
  const styles = useStyles();
  const { completeProfile, signOut, suggestedUsername } = useAuth();

  const [username, setUsername] = useState(suggestedUsername ?? '');
  const [favoriteSpecies, setFavoriteSpecies] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleContinue() {
    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      if (!(await isUsernameAvailable(username))) {
        setError('That username is already taken.');
        return;
      }
      await completeProfile({
        username: username.trim(),
        favoriteSpecies: favoriteSpecies.trim() || undefined,
        bio: bio.trim() || undefined,
      });
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (caught) {
      Alert.alert('Could not sign out', authErrorMessage(caught));
    }
  }

  return (
    <Screen scroll avoidKeyboard>
      <View style={styles.form}>
        <Text style={styles.heading}>Pick your handle</Text>
        <Text style={styles.body}>
          One last step — this is the name that shows up on your catches.
        </Text>

        <TextField
          label="Username"
          value={username}
          onChangeText={setUsername}
          placeholder="riverrat"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          maxLength={20}
          error={error}
          hint="Letters, numbers, and underscores."
        />

        <TextField
          label="Favorite species (optional)"
          value={favoriteSpecies}
          onChangeText={setFavoriteSpecies}
          placeholder="Largemouth bass"
          autoCapitalize="words"
        />

        <TextField
          label="Bio (optional)"
          value={bio}
          onChangeText={setBio}
          placeholder="Where you fish, what you throw..."
          multiline
          numberOfLines={3}
          maxLength={160}
          style={styles.bioInput}
        />

        <Button label="Start fishing" onPress={handleContinue} loading={busy} />
        <Button
          label="Sign out"
          variant="ghost"
          onPress={handleSignOut}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  form: {
    gap: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  heading: {
    ...Typography.title,
  },
  body: {
    ...Typography.body,
    color: Colors.textMuted,
  },
  bioInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
}));
