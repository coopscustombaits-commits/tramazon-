import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { REPORT_NOTE_MAX, REPORT_REASONS, submitReport } from '@/lib/db/safety';
import type { ReportReason, ReportTargetType } from '@/types/models';

/**
 * "Report this" — required by Apple for any app with user-generated content.
 *
 * A report is fire-and-forget from the user's side: they never hear back, and
 * they can't see the queue. That's deliberate — a reporting system that tells
 * you what happened also tells the reported person who reported them.
 */
export function ReportSheet({
  visible,
  onClose,
  targetType,
  targetId,
  targetOwnerId,
  parentId,
  targetLabel,
}: {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId: string;
  parentId?: string | null;
  /** e.g. "this catch", "riverrat". Shown in the heading. */
  targetLabel: string;
}) {
  const { user } = useAuth();
  const styles = useStyles();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!user || !reason) return;
    setSending(true);
    try {
      await submitReport({
        reporterId: user.uid,
        targetType,
        targetId,
        targetOwnerId,
        parentId: parentId ?? null,
        reason,
        note,
      });
      setReason(null);
      setNote('');
      onClose();
      Alert.alert(
        'Thanks — we’re on it',
        'Coop will take a look. You won’t hear back on this one, but every report gets read.',
      );
    } catch (error) {
      Alert.alert('Could not send the report', authErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Report {targetLabel}</Text>
          <Text style={styles.body}>What&apos;s wrong with it?</Text>

          <View style={styles.reasons}>
            {REPORT_REASONS.map((option) => {
              const active = reason === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setReason(option.value)}
                  style={[styles.reason, active && styles.reasonActive]}>
                  <Text style={[styles.reasonLabel, active && styles.reasonLabelActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextField
            label="Anything else? (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="Whatever helps Coop understand"
            multiline
            maxLength={REPORT_NOTE_MAX}
            style={styles.noteInput}
            editable={!sending}
          />

          <Button label="Send report" onPress={send} loading={sending} disabled={!reason} />
          <Button label="Cancel" variant="ghost" onPress={onClose} disabled={sending} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((Colors) => ({
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    maxHeight: '85%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    marginBottom: Spacing.sm,
  },
  content: { padding: Spacing.xl, gap: Spacing.md },
  heading: { ...Typography.title, color: Colors.text },
  body: { ...Typography.body, color: Colors.textMuted },
  reasons: { gap: Spacing.sm },
  reason: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  reasonActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryTint },
  reasonLabel: { ...Typography.body, color: Colors.text },
  reasonLabelActive: { color: Colors.primary, fontWeight: '600' },
  noteInput: { minHeight: 80, textAlignVertical: 'top' },
}));
