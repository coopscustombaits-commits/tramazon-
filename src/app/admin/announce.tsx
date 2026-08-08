import { useRouter } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen, ScreenLoader } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { paths } from '@/lib/db/paths';
import { db } from '@/lib/firebase';
import { SCHEMA_VERSION, type AnnouncementSegment } from '@/types/models';

/**
 * Who to send to. Every one of these is worked out server-side from data that
 * already exists, so segmenting needed no new field and no tracking.
 */
const SEGMENTS: { value: AnnouncementSegment; label: string; hint: string }[] = [
  { value: 'all', label: 'Everyone', hint: 'Every angler with the app.' },
  {
    value: 'posters',
    label: 'Active anglers',
    hint: 'Anyone with at least one approved catch.',
  },
  {
    value: 'quiet',
    label: 'Never posted',
    hint: 'Signed up but never posted — a nudge.',
  },
  { value: 'customers', label: 'Customers', hint: 'Anyone who has placed an order.' },
];

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
  const styles = useStyles();
  const router = useRouter();
  const { isAdmin, status, user } = useAuth();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [href, setHref] = useState('');
  const [segment, setSegment] = useState<AnnouncementSegment>('all');
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
      `Send to ${SEGMENTS.find((option) => option.value === segment)?.label.toLowerCase()}?`,
      'This pushes a notification to everyone in that group who hasn’t turned announcements off. It can’t be unsent.',
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
        segment,
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

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Send to</Text>
          <View style={styles.chips}>
            {SEGMENTS.map((option) => {
              const active = segment === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  disabled={sending}
                  onPress={() => setSegment(option.value)}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.fieldHint}>
            {SEGMENTS.find((option) => option.value === segment)?.hint}
          </Text>
        </View>

        <View style={styles.preview}>
          <Text style={styles.previewLabel}>Preview</Text>
          <Text style={styles.previewTitle}>{title.trim() || 'Title'}</Text>
          <Text style={styles.previewBody} numberOfLines={2}>
            {body.trim() || 'Your message shows up here.'}
          </Text>
        </View>

        <Button
          label={`Send to ${SEGMENTS.find((option) => option.value === segment)?.label.toLowerCase()}`}
          onPress={confirm}
          loading={sending}
        />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  field: { gap: Spacing.sm },
  fieldLabel: { ...Typography.caption, color: Colors.textMuted, fontWeight: '600' },
  fieldHint: { ...Typography.caption, color: Colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryTint },
  chipLabel: { ...Typography.caption, color: Colors.text },
  chipLabelActive: { color: Colors.primary, fontWeight: '700' },
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
}));
