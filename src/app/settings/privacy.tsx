import { Alert, Linking, Text, View } from 'react-native';

import { Card, Divider, ListRow, SectionHeader } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { PRIVACY_CONTENT } from '@/constants/content';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';

/**
 * Privacy and account management.
 *
 * The short version people will actually read, plus the controls that go with
 * it. Both app stores also require a publicly hosted policy URL, which lives
 * in `constants/content.ts`.
 */
export default function PrivacyScreen() {
  const styles = useStyles();
  const { user, sendPasswordReset } = useAuth();

  async function resetPassword() {
    if (!user?.email) {
      Alert.alert(
        'No password on this account',
        'You sign in with Google or Apple, so there’s no password here to change.',
      );
      return;
    }
    try {
      await sendPasswordReset(user.email);
      Alert.alert('Check your email', `We sent a reset link to ${user.email}.`);
    } catch (error) {
      Alert.alert('Could not send', authErrorMessage(error));
    }
  }

  return (
    <Screen scroll padded={false}>
      <View style={styles.body}>
        <Text style={styles.heading}>What we keep</Text>
        <Card style={styles.card}>
          {PRIVACY_CONTENT.collected.map((item) => (
            <Text key={item} style={styles.item}>
              • {item}
            </Text>
          ))}
        </Card>

        <Text style={styles.heading}>Who else sees it</Text>
        <Card style={styles.card}>
          {PRIVACY_CONTENT.shared.map((item) => (
            <Text key={item} style={styles.item}>
              • {item}
            </Text>
          ))}
        </Card>

        <SectionHeader title="Your account" />
        <Card style={styles.rows}>
          <ListRow
            label="Change your password"
            description={user?.email ?? 'Signed in with Google or Apple'}
            icon="key-outline"
            onPress={resetPassword}
          />
          <Divider />
          <ListRow
            label="Notification settings"
            description="Choose what you get pinged about"
            icon="notifications-outline"
            onPress={() => Linking.openSettings()}
            right={undefined}
          />
        </Card>

        <Text style={styles.note}>
          Deleting your account removes your profile, posts, photos, and saved items.
          That option is at the bottom of Settings, and it can&apos;t be undone.
        </Text>

        {PRIVACY_CONTENT.policyUrl ? (
          <Card style={styles.rows}>
            <ListRow
              label="Full privacy policy"
              icon="document-text-outline"
              onPress={() => void Linking.openURL(PRIVACY_CONTENT.policyUrl)}
            />
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  body: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  heading: { ...Typography.heading, marginTop: Spacing.md },
  card: { gap: Spacing.sm },
  rows: { padding: 0, overflow: 'hidden', borderRadius: Radius.lg },
  item: { ...Typography.body, color: Colors.textMuted },
  note: { ...Typography.caption, marginTop: Spacing.md },
}));
