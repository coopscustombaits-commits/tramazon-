import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { competitionPhase, competitionTiming } from '@/lib/competitions';
import { useBlocked } from '@/lib/db/blocked-context';
import {
  fetchLeaderboard,
  setWinner,
  subscribeToCompetition,
} from '@/lib/db/competitions';
import { plural } from '@/lib/format';
import { speciesLabel } from '@/lib/species';
import type { Competition, CompetitionKind, Post } from '@/types/models';

/** One challenge or tournament, with its leaderboard. */
export default function CompetitionScreen() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind: CompetitionKind }>();
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();
  const { user, isAdmin } = useAuth();
  const { filterBlocked } = useBlocked();

  const [competition, setCompetition] = useState<Competition | null | undefined>(undefined);
  const [entries, setEntries] = useState<Post[]>([]);

  useEffect(() => {
    if (!id || !kind) return;
    return subscribeToCompetition(kind, id, setCompetition, (error) => {
      console.warn('[compete] load failed', error);
      setCompetition(null);
    });
  }, [id, kind]);

  // The leaderboard is a query over posts rather than a stored ranking, so it
  // can't drift from the entries. Refetched when the scoring rule changes.
  const scoring = competition?.scoring;
  useEffect(() => {
    if (!id || !kind || !scoring) return;
    let cancelled = false;
    fetchLeaderboard(kind, id, scoring)
      .then((result) => {
        if (!cancelled) setEntries(result);
      })
      .catch((error: unknown) => console.warn('[compete] leaderboard failed', error));
    return () => {
      cancelled = true;
    };
  }, [id, kind, scoring]);

  function confirmWinner(post: Post) {
    if (!competition) return;
    Alert.alert(
      `Declare ${post.author.username} the winner?`,
      'Shown at the top of this page. You can change it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Declare winner',
          onPress: () => {
            void setWinner(kind, competition.id, post).catch((error: unknown) =>
              Alert.alert('Could not save', authErrorMessage(error)),
            );
          },
        },
      ],
    );
  }

  if (competition === undefined) return <ScreenLoader />;

  if (!competition) {
    return (
      <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <EmptyState title="Not found" message="This may have been taken down." />
      </SafeAreaView>
    );
  }

  const phase = competitionPhase(competition);
  const visible = filterBlocked(entries);
  const winner = visible.find((post) => post.id === competition.winnerPostId) ?? null;

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: competition.title }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Ionicons
            name={competition.kind === 'tournament' ? 'trophy' : 'flag'}
            size={16}
            color={Colors.accent}
          />
          <Text style={styles.kind}>
            {competition.kind === 'tournament' ? 'Tournament' : 'Challenge'}
          </Text>
          <Text style={[styles.timing, phase === 'open' && styles.timingOpen]}>
            {competitionTiming(competition)}
          </Text>
        </View>

        <Text style={styles.title}>{competition.title}</Text>
        {competition.description ? (
          <Text style={styles.description}>{competition.description}</Text>
        ) : null}

        <View style={styles.facts}>
          {competition.prize ? (
            <Fact icon="gift-outline" label="Prize" value={competition.prize} />
          ) : null}
          {competition.speciesSlug ? (
            <Fact
              icon="fish-outline"
              label="Species"
              value={speciesLabel(competition.speciesSlug)}
            />
          ) : null}
          <Fact
            icon="people-outline"
            label="Entries"
            value={plural(competition.entryCount, 'entry', 'entries')}
          />
          <Fact
            icon="podium-outline"
            label="Scored by"
            value={competition.scoring === 'admin_pick' ? 'Coop picks' : 'Most likes'}
          />
        </View>

        {winner ? (
          <View style={styles.winner}>
            <Ionicons name="trophy" size={20} color={Colors.accent} />
            <Text style={styles.winnerText}>
              Winner: {winner.author.username}
            </Text>
          </View>
        ) : null}

        {phase === 'open' ? (
          <Button
            label="Enter with a catch"
            icon="camera-outline"
            onPress={() => router.push('/(tabs)/create')}
          />
        ) : phase === 'upcoming' ? (
          <Text style={styles.notice}>Not started yet — check back.</Text>
        ) : (
          <Text style={styles.notice}>Entries are closed.</Text>
        )}

        <Text style={styles.leaderboardTitle}>Leaderboard</Text>
        {visible.length === 0 ? (
          <Text style={styles.notice}>
            No approved entries yet. Post a catch and it lands here once Coop approves it.
          </Text>
        ) : (
          visible.map((post, index) => (
            <Pressable
              key={post.id}
              accessibilityRole="button"
              onPress={() => router.push(`/post/${post.id}`)}
              onLongPress={() => (isAdmin ? confirmWinner(post) : undefined)}
              style={({ pressed }) => [styles.entry, pressed && styles.entryPressed]}>
              <Text style={styles.rank}>{index + 1}</Text>
              <Image
                source={{ uri: post.media.thumbnailUrl ?? post.media.url }}
                style={styles.thumb}
                contentFit="cover"
                accessibilityIgnoresInvertColors
              />
              <View style={styles.entryBody}>
                <View style={styles.entryNameRow}>
                  <Avatar uri={post.author.photoURL} name={post.author.username} size={20} />
                  <Text style={styles.entryName} numberOfLines={1}>
                    {post.author.username}
                  </Text>
                  {post.authorId === user?.uid ? (
                    <Text style={styles.you}>you</Text>
                  ) : null}
                </View>
                {post.caption ? (
                  <Text style={styles.entryCaption} numberOfLines={1}>
                    {post.caption}
                  </Text>
                ) : null}
              </View>
              <View style={styles.likes}>
                <Ionicons name="heart" size={14} color={Colors.danger} />
                <Text style={styles.likeCount}>{post.likeCount}</Text>
              </View>
            </Pressable>
          ))
        )}

        {isAdmin && visible.length > 0 ? (
          <Text style={styles.adminHint}>Press and hold an entry to declare a winner.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const Colors = useThemeColors();
  const styles = useStyles();
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  kind: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timing: { ...Typography.caption, color: Colors.textFaint, marginLeft: 'auto' },
  timingOpen: { color: Colors.success, fontWeight: '600' },
  title: { ...Typography.title, color: Colors.text },
  description: { ...Typography.body, color: Colors.text, lineHeight: 22 },
  facts: {
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fact: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  factLabel: { ...Typography.caption, color: Colors.textMuted, width: 76 },
  factValue: { ...Typography.caption, color: Colors.text, fontWeight: '600', flex: 1 },
  winner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryTint,
  },
  winnerText: { ...Typography.bodyStrong, color: Colors.primary },
  notice: { ...Typography.caption, color: Colors.textMuted },
  leaderboardTitle: { ...Typography.heading, color: Colors.text, marginTop: Spacing.md },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  entryPressed: { opacity: 0.85 },
  rank: {
    ...Typography.bodyStrong,
    color: Colors.textMuted,
    width: 22,
    textAlign: 'center',
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
  },
  entryBody: { flex: 1, gap: 2 },
  entryNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  entryName: { ...Typography.bodyStrong, color: Colors.text, flexShrink: 1 },
  you: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },
  entryCaption: { ...Typography.caption, color: Colors.textMuted },
  likes: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  likeCount: { ...Typography.caption, color: Colors.textMuted },
  adminHint: { ...Typography.caption, color: Colors.textFaint, textAlign: 'center' },
}));
