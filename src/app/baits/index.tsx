import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { RatingStars } from '@/components/rating-stars';
import { Button } from '@/components/ui/button';
import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { baitId, fetchReviewedBaits } from '@/lib/db/reviews';
import { plural } from '@/lib/format';
import type { ReviewSummary } from '@/types/models';

/**
 * Community bait reviews — any bait, not just ones Coop sells.
 *
 * There's no bait catalogue to browse: a bait exists here once somebody has
 * reviewed it. That's why the search box doubles as "add a bait" — typing a
 * name that nobody has reviewed takes you to an empty page for it rather than
 * a dead end.
 */
export default function BaitsScreen() {
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();

  const [baits, setBaits] = useState<ReviewSummary[] | null>(null);
  const [name, setName] = useState('');

  // Refetch on focus so a review written on the detail screen is reflected
  // when you come back. Ratings are aggregated server-side, so there's a
  // moment where a fresh review hasn't landed in the average yet.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchReviewedBaits()
        .then((result) => {
          if (!cancelled) setBaits(result);
        })
        .catch((error: unknown) => {
          console.warn('[baits] load failed', error);
          if (!cancelled) setBaits([]);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  function open() {
    const slug = baitId(name);
    if (!slug) {
      Alert.alert('Name the bait', 'Type the name of a bait to review it.');
      return;
    }
    router.push({ pathname: '/baits/[slug]', params: { slug, name: name.trim() } });
  }

  if (!baits) return <ScreenLoader />;

  const query = baitId(name);
  const filtered = query ? baits.filter((bait) => bait.id.includes(query)) : baits;

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: 'Bait Reviews' }} />
      <FlatList
        data={filtered}
        keyExtractor={(bait) => bait.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.intro}>
              What actually works, from people who fish it. Any bait — not just Coop&apos;s.
            </Text>
            <TextField
              label="Find or add a bait"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Chatterbait, Ned rig, Zoom Fluke"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={open}
            />
            {name.trim().length > 0 ? (
              <Button
                label={`Review “${name.trim()}”`}
                icon="star-outline"
                variant="outline"
                onPress={open}
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/baits/[slug]',
                params: { slug: item.id, name: item.title },
              })
            }
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <Ionicons name="fish-outline" size={22} color={Colors.primary} />
            <View style={styles.rowBody}>
              <Text style={styles.name}>{item.title}</Text>
              <View style={styles.ratingRow}>
                <RatingStars value={item.ratingAverage} size={13} />
                <Text style={styles.count}>
                  {item.ratingAverage.toFixed(1)} ·{' '}
                  {plural(item.reviewCount, 'review')}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textFaint} />
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            title={query ? 'No bait by that name yet' : 'No bait reviews yet'}
            message={
              query
                ? 'Be the first to review it — tap the button above.'
                : 'Type a bait name above to write the first review.'
            }
          />
        }
      />
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: { padding: Spacing.lg, paddingBottom: Spacing.xxl, flexGrow: 1 },
  header: { gap: Spacing.md, marginBottom: Spacing.lg },
  intro: { ...Typography.body, color: Colors.textMuted },
  separator: { height: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowPressed: { opacity: 0.85 },
  rowBody: { flex: 1, gap: 2 },
  name: { ...Typography.bodyStrong, color: Colors.text },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  count: { ...Typography.caption, color: Colors.textMuted },
}));
