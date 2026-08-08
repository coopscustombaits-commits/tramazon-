import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { useBlocked } from '@/lib/db/blocked-context';
import { POINT_VALUES, fetchTopAnglers } from '@/lib/db/rewards';
import type { UserProfile } from '@/types/models';

/** Colours for the top three. Everyone else gets a plain number. */
const MEDALS = ['#D4A437', '#A8A8A8', '#B0733A'];

/**
 * All-time angler leaderboard, ranked by points.
 *
 * Points are server-written and denied to every client by the security rules.
 * That denial is the whole reason this is worth showing — a ranking anyone
 * could edit is decoration.
 */
export default function LeaderboardScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { user } = useAuth();
  const { blockedIds } = useBlocked();

  const [anglers, setAnglers] = useState<UserProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchTopAnglers()
        .then((result) => {
          if (cancelled) return;
          setAnglers(result);
          setError(null);
        })
        .catch((caught: unknown) => {
          console.warn('[leaderboard] load failed', caught);
          if (!cancelled) {
            setError('Could not load the leaderboard.');
            setAnglers([]);
          }
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (!anglers) return <ScreenLoader />;

  // Ranks are worked out before filtering, so blocking somebody doesn't
  // silently move you up the board.
  const ranked = anglers.map((angler, index) => ({ angler, rank: index + 1 }));
  const visible = ranked.filter(({ angler }) => !blockedIds.has(angler.uid));

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: 'Leaderboard' }} />
      <FlatList
        data={visible}
        keyExtractor={({ angler }) => angler.uid}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.intro}>Points earned all time.</Text>
            <View style={styles.scoring}>
              <ScoreLine label="Catch approved" value={POINT_VALUES.post_approved} />
              <ScoreLine label="Someone likes your catch" value={POINT_VALUES.like_received} />
              <ScoreLine label="Write a review" value={POINT_VALUES.review_written} />
              <ScoreLine label="Enter a challenge" value={POINT_VALUES.competition_entered} />
              <ScoreLine label="Win a challenge" value={POINT_VALUES.competition_won} />
            </View>
          </View>
        }
        renderItem={({ item: { angler, rank } }) => {
          const mine = angler.uid === user?.uid;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${rank}. ${angler.username}, ${angler.points} points`}
              onPress={() =>
                router.push(mine ? '/(tabs)/profile' : `/user/${angler.uid}`)
              }
              style={({ pressed }) => [
                styles.row,
                mine && styles.rowMine,
                pressed && styles.rowPressed,
              ]}>
              {rank <= 3 ? (
                <Ionicons name="trophy" size={20} color={MEDALS[rank - 1]} />
              ) : (
                <Text style={styles.rank}>{rank}</Text>
              )}
              <Avatar uri={angler.photoURL} name={angler.username} size={36} />
              <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={1}>
                  {angler.username}
                  {mine ? <Text style={styles.you}> · you</Text> : null}
                </Text>
                <Text style={styles.meta}>
                  {angler.postCount} {angler.postCount === 1 ? 'catch' : 'catches'}
                </Text>
              </View>
              <View style={styles.points}>
                <Text style={styles.pointsValue}>{angler.points ?? 0}</Text>
                <Text style={styles.pointsLabel}>pts</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title={error ? 'Something went wrong' : 'Nobody on the board yet'}
            message={
              error ?? 'Post a catch and get it approved — that’s ten points to start.'
            }
          />
        }
        ListFooterComponent={
          visible.length > 0 ? (
            <Text style={styles.footer}>
              Points are worked out on the server, so nobody can put their thumb on the
              scale. Taking a catch down takes its points back with it.
            </Text>
          ) : null
        }
      />
    </Screen>
  );
}

function ScoreLine({ label, value }: { label: string; value: number }) {
  const styles = useStyles();
  return (
    <View style={styles.scoreLine}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={styles.scoreValue}>+{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: { padding: Spacing.lg, paddingBottom: Spacing.xxl, flexGrow: 1 },
  header: { gap: Spacing.md, marginBottom: Spacing.lg },
  intro: { ...Typography.body, color: Colors.textMuted },
  scoring: {
    gap: Spacing.xs,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scoreLine: { flexDirection: 'row', alignItems: 'center' },
  scoreLabel: { ...Typography.caption, color: Colors.textMuted, flex: 1 },
  scoreValue: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },
  separator: { height: Spacing.sm },
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
  rowMine: { borderColor: Colors.primary, backgroundColor: Colors.primaryTint },
  rowPressed: { opacity: 0.85 },
  rank: {
    ...Typography.bodyStrong,
    color: Colors.textMuted,
    width: 20,
    textAlign: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  name: { ...Typography.bodyStrong, color: Colors.text },
  you: { ...Typography.caption, color: Colors.primary },
  meta: { ...Typography.caption, color: Colors.textMuted },
  points: { alignItems: 'flex-end' },
  pointsValue: { ...Typography.heading, color: Colors.text },
  pointsLabel: { ...Typography.caption, color: Colors.textFaint },
  footer: {
    ...Typography.caption,
    color: Colors.textFaint,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
}));
