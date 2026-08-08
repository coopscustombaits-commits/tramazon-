import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { competitionPhase, competitionTiming } from '@/lib/competitions';
import { fetchCompetitions } from '@/lib/db/competitions';
import { plural } from '@/lib/format';
import type { Competition } from '@/types/models';

/**
 * Challenges and tournaments in one list.
 *
 * They're separate collections but the same thing to enter, so splitting them
 * across two tabs would mean checking two places to find out what's running.
 * The badge on each card says which it is.
 */
export default function CompeteScreen() {
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();

  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([fetchCompetitions('challenge'), fetchCompetitions('tournament')])
        .then(([challenges, tournaments]) => {
          if (cancelled) return;
          // Open first, then upcoming, then ended — nobody opens this screen
          // to read about something that finished last month.
          const order = { open: 0, upcoming: 1, ended: 2 };
          setCompetitions(
            [...challenges, ...tournaments].sort(
              (a, b) => order[competitionPhase(a)] - order[competitionPhase(b)],
            ),
          );
          setError(null);
        })
        .catch((caught: unknown) => {
          console.warn('[compete] load failed', caught);
          if (!cancelled) {
            setError('Could not load challenges right now.');
            setCompetitions([]);
          }
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (!competitions) return <ScreenLoader />;

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: 'Challenges' }} />
      <FlatList
        data={competitions}
        keyExtractor={(competition) => `${competition.kind}-${competition.id}`}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const phase = competitionPhase(item);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/compete/[id]',
                  params: { id: item.id, kind: item.kind },
                })
              }
              style={({ pressed }) => [
                styles.card,
                phase === 'ended' && styles.cardEnded,
                pressed && styles.cardPressed,
              ]}>
              <View style={styles.cardHeader}>
                <Ionicons
                  name={item.kind === 'tournament' ? 'trophy' : 'flag'}
                  size={16}
                  color={Colors.accent}
                />
                <Text style={styles.kind}>
                  {item.kind === 'tournament' ? 'Tournament' : 'Challenge'}
                </Text>
                <Text style={[styles.timing, phase === 'open' && styles.timingOpen]}>
                  {competitionTiming(item)}
                </Text>
              </View>

              <Text style={styles.title}>{item.title}</Text>
              {item.description ? (
                <Text style={styles.description} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              <View style={styles.footer}>
                {item.prize ? (
                  <View style={styles.prize}>
                    <Ionicons name="gift-outline" size={14} color={Colors.primary} />
                    <Text style={styles.prizeLabel}>{item.prize}</Text>
                  </View>
                ) : null}
                <Text style={styles.entries}>{plural(item.entryCount, 'entry', 'entries')}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title={error ? 'Something went wrong' : 'Nothing running right now'}
            message={
              error ??
              'Coop hasn’t started a challenge yet. When he does, it shows up here and you enter by posting a catch.'
            }
          />
        }
      />
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: { padding: Spacing.lg, paddingBottom: Spacing.xxl, flexGrow: 1 },
  separator: { height: Spacing.lg },
  card: {
    gap: Spacing.xs,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardEnded: { opacity: 0.6 },
  cardPressed: { opacity: 0.85 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  kind: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timing: { ...Typography.caption, color: Colors.textFaint, marginLeft: 'auto' },
  timingOpen: { color: Colors.success, fontWeight: '600' },
  title: { ...Typography.heading, color: Colors.text },
  description: { ...Typography.body, color: Colors.textMuted },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  prize: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1 },
  prizeLabel: { ...Typography.caption, color: Colors.primary, fontWeight: '600', flex: 1 },
  entries: { ...Typography.caption, color: Colors.textMuted },
}));
