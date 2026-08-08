import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { APPEAL_MAX, submitAppeal } from '@/lib/db/appeals';
import type { AppealKind } from '@/types/models';

/**
 * "I think this was wrong."
 *
 * Filing twice about the same decision replaces the first one rather than
 * adding to the queue — someone who's just had a catch rejected will tap this
 * more than once, and a queue full of the same complaint helps nobody.
 */
export function AppealSheet({
  visible,
  onClose,
  kind,
  targetId,
  what,
}: {
  visible: boolean;
  onClose: () => void;
  kind: AppealKind;
  targetId: string;
  /** e.g. "this catch", "your account". Shown in the heading. */
  what: string;
}) {
  const { profile } = useAuth();
  const styles = useStyles();

  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!profile || !message.trim()) return;
    setSending(true);
    try {
      await submitAppeal({ profile, kind, targetId, message });
      setMessage('');
      onClose();
      Alert.alert(
        'Sent to Coop',
        'He reads every one. You’ll see the outcome on your appeals list — this may take a day or two.',
      );
    } catch (error) {
      Alert.alert('Could not send that', authErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Appeal — {what}</Text>
          <Text style={styles.body}>
            Tell Coop why you think the decision was wrong. He reads these himself.
          </Text>

          <TextField
            label="What happened"
            value={message}
            onChangeText={setMessage}
            placeholder="This was a legal fish caught on the lake, not anything against the rules."
            multiline
            maxLength={APPEAL_MAX}
            style={styles.input}
            editable={!sending}
            hint={`${message.length}/${APPEAL_MAX}`}
          />

          <Button
            label="Send the appeal"
            onPress={() => void send()}
            loading={sending}
            disabled={!message.trim()}
          />
          <Button label="Cancel" variant="ghost" onPress={onClose} disabled={sending} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((Colors) => ({
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginTop: Spacing.sm,
  },
  content: { padding: Spacing.lg, gap: Spacing.md },
  heading: { ...Typography.heading, color: Colors.text },
  body: { ...Typography.body, color: Colors.textMuted },
  input: { minHeight: 120, textAlignVertical: 'top' },
}));
