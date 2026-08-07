import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { RatingStars } from '@/components/rating-stars';
import { ReviewSheet } from '@/components/review-sheet';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { useBlocked } from '@/lib/db/blocked-context';
import {
  deleteReview,
  formatRating,
  subscribeToReviewSummary,
  subscribeToReviews,
} from '@/lib/db/reviews';
import { shortTimeAgo } from '@/lib/format';
import type { Review, ReviewKind, ReviewSummary } from '@/types/models';

/**
 * Ratings and reviews for one product or one bait.
 *
 * Both kinds render identically — the only thing that differs is which root
 * collection they read, which `lib/db/reviews.ts` handles. A verified-purchase
 * badge only ever appears on product reviews, because only those have an order
 * to match against.
 */
export function ReviewsSection({
  kind,
  subjectId,
  subjectTitle,
  onPressAuthor,
}: {
  kind: ReviewKind;
  subjectId: string;
  subjectTitle: string;
  onPressAuthor?: (uid: string) => void;
}) {
  const Colors = useThemeColors();
  const styles = useStyles();
  const { user } = useAuth();
  const { filterBlocked } = useBlocked();

  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    if (!subjectId) return;
    return subscribeToReviewSummary(kind, subjectId, setSummary, (error) =>
      console.warn('[reviews] summary failed', error),
    );
  }, [kind, subjectId]);

  useEffect(() => {
    if (!subjectId) return;
    return subscribeToReviews(kind, subjectId, setReviews, (error) =>
      console.warn('[reviews] list failed', error),
    );
  }, [kind, subjectId]);

  const mine = reviews.find((review) => review.authorId === user?.uid) ?? null;
  // `filterBlocked` keys on `authorId`, which reviews carry for this reason.
  const visible = filterBlocked(reviews);
  const average = formatRating(summary);

  function confirmDelete() {
    Alert.alert('Delete your review?', 'This removes it from the average too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (!user) return;
          void deleteReview(kind, subjectId, user.uid).catch((error: unknown) =>
            Alert.alert('Could not delete', authErrorMessage(error)),
          );
        },
      },
    ]);
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Reviews</Text>
        {average ? (
          <View style={styles.averageRow}>
            <RatingStars value={summary?.ratingAverage ?? 0} size={16} />
            <Text style={styles.average}>
              {average} · {summary?.reviewCount}
            </Text>
          </View>
        ) : null}
      </View>

      {visible.length === 0 ? (
        <Text style={styles.empty}>
          No reviews yet. If you&apos;ve fished it, you know more than the description does.
        </Text>
      ) : (
        visible.map((review) => (
          <View key={review.id} style={styles.review}>
            <Pressable
              accessibilityRole={onPressAuthor ? 'button' : undefined}
              onPress={() => onPressAuthor?.(review.authorId)}
              style={styles.reviewHeader}>
              <Avatar uri={review.author.photoURL} name={review.author.username} size={32} />
              <View style={styles.reviewMeta}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{review.author.username}</Text>
                  {review.verifiedPurchase ? (
                    <View style={styles.verified}>
                      <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                      <Text style={styles.verifiedLabel}>Verified purchase</Text>
                    </View>
                  ) : null}
                </View>
                <RatingStars value={review.rating} size={13} />
              </View>
              <Text style={styles.time}>{shortTimeAgo(review.createdAt)}</Text>
            </Pressable>
            {review.text ? <Text style={styles.body}>{review.text}</Text> : null}
          </View>
        ))
      )}

      {mine ? (
        <View style={styles.myActions}>
          <Button
            label="Edit your review"
            variant="outline"
            fullWidth={false}
            onPress={() => setComposing(true)}
          />
          <Button
            label="Delete"
            variant="ghost"
            fullWidth={false}
            onPress={confirmDelete}
          />
        </View>
      ) : (
        <Button
          label="Write a review"
          icon="star-outline"
          variant="outline"
          onPress={() => setComposing(true)}
        />
      )}

      {composing ? (
        <ReviewSheet
          visible
          onClose={() => setComposing(false)}
          kind={kind}
          subjectId={subjectId}
          subjectTitle={subjectTitle}
          existing={mine}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  section: { gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...Typography.heading, color: Colors.text },
  averageRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  average: { ...Typography.caption, color: Colors.textMuted, fontWeight: '600' },
  empty: { ...Typography.caption, color: Colors.textMuted },
  review: {
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  reviewMeta: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  name: { ...Typography.bodyStrong, color: Colors.text },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  verifiedLabel: { ...Typography.caption, color: Colors.success, fontSize: 11 },
  time: { ...Typography.caption, color: Colors.textFaint },
  body: { ...Typography.body, color: Colors.text },
  myActions: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
}));
