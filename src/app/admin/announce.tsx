import { useRouter } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen, ScreenLoader } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { paths } from '@/lib/db/paths';
import { db } from '@/lib/firebase';
import { SCHEMA_VERSION } from '@/types/models';

const TITLE_MAX = 100;
const BODY_MAX = 500;

/**
 * Admin-only: send a push to everyone — a new bait, a restock, shop news.
 *
 * Writing the document is the whole action. A Cloud Function watches the
 * collection and does the fan-out, so this screen doesn't wait on thousands of
 * sends and can't half-finish.
 */
export default function AnnounceScreen() {
  const router = useRouter();
  const { isAdmin, status, user } = useAuth();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [href, setHref] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (status === 'signed-in' && !isAdmin) router.replace('/(tabs)');
  }, [isAdmin, status, router]);

  function confirm() {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Add a title and a message', 'Both are shown in the notification.');
      return;
    }

    Alert.alert(
      'Send to everyone?',
      'This pushes a notification to every angler who has the app installed and hasn’t turned announcements off. It can’t be unsent.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', style: 'destructive', onPress: () => void send() },
      ],
    );
  }

  async function send() {
    if (!user) return;
    setSending(true);
    try {
      await addDoc(collection(db, paths.announcements), {
        schemaVersion: SCHEMA_VERSION,
        title: title.trim().slice(0, TITLE_MAX),
        body: body.trim().slice(0, BODY_MAX),
        href: href.trim() || null,
        createdBy: user.uid,
        sentAt: null,
        recipientCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setTitle('');
      setBody('');
      setHref('');
      Alert.alert('On its way', 'The notification is going out now.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Could not send', authErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

  if (!isAdmin) return <ScreenLoader />;

  return (
    <Screen scroll avoidKeyboard>
      <View style={styles.form}>
        <Text style={styles.heading}>Send an announcement</Text>
        <Text style={styles.body}>
          Goes to everyone with the app installed. Keep it short — most people only
          see the first line.
        </Text>

        <TextField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="New bait drop"
          maxLength={TITLE_MAX}
          editable={!sending}
          hint={`${title.length}/${TITLE_MAX}`}
        />

        <TextField
          label="Message"
          value={body}
          onChangeText={setBody}
          placeholder="The Chartreuse Shad is back in stock, limited run."
          multiline
          maxLength={BODY_MAX}
          style={styles.bodyInput}
          editable={!sending}
          hint={`${body.length}/${BODY_MAX}`}
        />

        <TextField
          label="Open this when tapped (optional)"
          value={href}
          onChangeText={setHref}
          placeholder="/product/chartreuse-shad"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!sending}
          hint="A path inside the app. Leave blank to just open the app."
        />

        <View style={styles.preview}>
          <Text style={styles.previewLabel}>Preview</Text>
          <Text style={styles.previewTitle}>{title.trim() || 'Title'}</Text>
          <Text style={styles.previewBody} numberOfLines={2}>
            {body.trim() || 'Your message shows up here.'}
          </Text>
        </View>

        <Button label="Send to everyone" onPress={confirm} loading={sending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.lg, paddingTop: Spacing.lg },
  heading: { ...Typography.title },
  body: { ...Typography.body, color: Colors.textMuted },
  bodyInput: { minHeight: 110, textAlignVertical: 'top' },
  preview: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 2,
  },
  previewLabel: { ...Typography.label },
  previewTitle: { ...Typography.bodyStrong },
  previewBody: { ...Typography.caption },
});
