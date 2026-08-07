import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { RatingStars } from '@/components/rating-stars';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { REVIEW_MAX, submitReview } from '@/lib/db/reviews';
import type { Review, ReviewKind } from '@/types/models';

/**
 * Write or edit a review.
 *
 * There's one review per person per thing — the document id is the author's
 * uid — so this doubles as the edit form. Passing `existing` prefills it and
 * the write overwrites rather than stacking.
 */
export function ReviewSheet({
  visible,
  onClose,
  kind,
  subjectId,
  subjectTitle,
  existing,
}: {
  visible: boolean;
  onClose: () => void;
  kind: ReviewKind;
  subjectId: string;
  subjectTitle: string;
  existing?: Review | null;
}) {
  const { profile } = useAuth();
  const styles = useStyles();

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [text, setText] = useState(existing?.text ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!profile || rating === 0) return;
    setSaving(true);
    try {
      await submitReview({ kind, subjectId, title: subjectTitle, profile, rating, text });
      onClose();
    } catch (error) {
      Alert.alert('Could not save your review', authErrorMessage(error));
    } finally {
      setSaving(false);
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
          <Text style={styles.heading}>
            {existing ? 'Edit your review' : 'Review'} {subjectTitle}
          </Text>

          <View style={styles.ratingRow}>
            <RatingStars
              value={rating}
              size={34}
              onChange={setRating}
              label="Your rating"
            />
            <Text style={styles.ratingHint}>
              {rating === 0 ? 'Tap to rate' : `${rating} of 5`}
            </Text>
          </View>

          <TextField
            label="How did it fish? (optional)"
            value={text}
            onChangeText={setText}
            placeholder="Water, conditions, what you caught on it"
            multiline
            maxLength={REVIEW_MAX}
            style={styles.textInput}
            editable={!saving}
          />

          <Button
            label={existing ? 'Save changes' : 'Post review'}
            onPress={save}
            loading={saving}
            disabled={rating === 0}
          />
          <Button label="Cancel" variant="ghost" onPress={onClose} disabled={saving} />
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
  ratingRow: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm },
  ratingHint: { ...Typography.caption, color: Colors.textMuted },
  textInput: { minHeight: 100, textAlignVertical: 'top' },
}));
