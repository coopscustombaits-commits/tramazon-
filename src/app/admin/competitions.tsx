import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { competitionTiming } from '@/lib/competitions';
import { deleteCompetition, subscribeToAllCompetitions } from '@/lib/db/competitions';
import { plural } from '@/lib/format';
import type { Competition, CompetitionKind } from '@/types/models';

/** Admin-only: every challenge and tournament, drafts included. */
export default function AdminCompetitionsScreen() {
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();
  const { isAdmin, status } = useAuth();

  const [challenges, setChallenges] = useState<Competition[] | null>(null);
  const [tournaments, setTournaments] = useState<Competition[] | null>(null);

  useEffect(() => {
    if (status === 'signed-in' && !isAdmin) router.replace('/(tabs)');
  }, [isAdmin, status, router]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeToAllCompetitions('challenge', setChallenges, (error) => {
      console.warn('[admin/competitions] challenges failed', error);
      setChallenges([]);
    });
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeToAllCompetitions('tournament', setTournaments, (error) => {
      console.warn('[admin/competitions] tournaments failed', error);
      setTournaments([]);
    });
  }, [isAdmin]);

  function confirmDelete(competition: Competition) {
    Alert.alert(
      `Delete “${competition.title}”?`,
      competition.entryCount > 0
        ? `${plural(competition.entryCount, 'catch', 'catches')} entered this. The posts stay; they just stop being entries.`
        : 'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteCompetition(competition.kind, competition).catch((error: unknown) =>
              Alert.alert('Could not delete', authErrorMessage(error)),
            );
          },
        },
      ],
    );
  }

  function create(kind: CompetitionKind) {
    router.push({ pathname: '/admin/competition-edit', params: { kind } });
  }

  if (!isAdmin || !challenges || !tournaments) return <ScreenLoader />;

  const all = [...challenges, ...tournaments];

  return (
    <Screen padded={false}>
      <FlatList
        data={all}
        keyExtractor={(competition) => `${competition.kind}-${competition.id}`}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.actions}>
            <Button
              label="New challenge"
              icon="flag-outline"
              variant="outline"
              onPress={() => create('challenge')}
              style={styles.action}
            />
            <Button
              label="New tournament"
              icon="trophy-outline"
              variant="outline"
              onPress={() => create('tournament')}
              style={styles.action}
            />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.title}`}
            onPress={() =>
              router.push({
                pathname: '/admin/competition-edit',
                params: { kind: item.kind, id: item.id },
              })
            }
            onLongPress={() => confirmDelete(item)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <Ionicons
              name={item.kind === 'tournament' ? 'trophy-outline' : 'flag-outline'}
              size={20}
              color={Colors.primary}
            />
            <View style={styles.rowBody}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title || 'Untitled'}
              </Text>
              <Text style={styles.meta}>
                {item.published ? competitionTiming(item) : 'Draft'} ·{' '}
                {plural(item.entryCount, 'entry', 'entries')}
              </Text>
            </View>
            {item.published ? null : <View style={styles.draftDot} />}
            <Ionicons name="chevron-forward" size={18} color={Colors.textFaint} />
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Nothing running"
            message="Start a challenge and anglers enter it by posting a catch."
          />
        }
      />
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: { padding: Spacing.lg, paddingBottom: Spacing.xxl, flexGrow: 1 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  action: { flex: 1 },
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
  title: { ...Typography.bodyStrong, color: Colors.text },
  meta: { ...Typography.caption, color: Colors.textMuted },
  draftDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent },
}));
