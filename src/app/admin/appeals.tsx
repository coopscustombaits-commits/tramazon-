import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { decideAppeal, subscribeToOpenAppeals } from '@/lib/db/appeals';
import { shortTimeAgo } from '@/lib/format';
import type { Appeal } from '@/types/models';

/**
 * Admin-only: appeals waiting on a decision.
 *
 * Deciding an appeal doesn't undo anything by itself. Granting one about a
 * catch still leaves re-approving the catch as its own deliberate act — an
 * appeal that silently reversed a moderation decision would make the two
 * impossible to tell apart afterwards, which is exactly what an appeals
 * record is for.
 */
export default function AdminAppealsScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { isAdmin, status, user } = useAuth();

  const [appeals, setAppeals] = useState<Appeal[] | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);

  useEffect(() => {
    if (status === 'signed-in' && !isAdmin) router.replace('/(tabs)');
  }, [isAdmin, status, router]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeToOpenAppeals(setAppeals, (error) => {
      console.warn('[admin/appeals] load failed', error);
      setAppeals([]);
    });
  }, [isAdmin]);

  async function decide(appeal: Appeal, outcome: 'granted' | 'denied', note: string) {
    if (!user) return;
    setBusyIds((current) => [...current, appeal.id]);
    try {
      await decideAppeal(appeal.id, user.uid, outcome, note);
    } catch (error) {
      Alert.alert('Could not save that', authErrorMessage(error));
    } finally {
      setBusyIds((current) => current.filter((id) => id !== appeal.id));
    }
  }

  function confirmGrant(appeal: Appeal) {
    Alert.alert(
      'Overturn the decision?',
      appeal.kind === 'post'
        ? 'This records that you agreed. Putting the catch back in the feed is a separate step — open it and approve it.'
        : 'This records that you agreed. Reinstating the account is a separate step — Dashboard → Anglers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Overturn',
          onPress: () => void decide(appeal, 'granted', 'Fair enough — decision reversed.'),
        },
      ],
    );
  }

  function open(appeal: Appeal) {
    if (appeal.kind === 'post') {
      router.push(`/post/${appeal.targetId}`);
    } else {
      router.push(`/user/${appeal.targetId}`);
    }
  }

  if (!isAdmin || !appeals) return <ScreenLoader />;

  return (
    <Screen padded={false}>
      <FlatList
        data={appeals}
        keyExtractor={(appeal) => appeal.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.header}>
              <Badge
                label={item.kind === 'post' ? 'Catch' : 'Account'}
                tone="pending"
              />
              <Text style={styles.who}>{item.username}</Text>
              <Text style={styles.time}>{shortTimeAgo(item.createdAt)}</Text>
            </View>

            <Text style={styles.message}>&ldquo;{item.message}&rdquo;</Text>

            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => open(item)}
              style={styles.link}>
              <Text style={styles.linkLabel}>
                {item.kind === 'post' ? 'Open the catch' : 'Open their profile'}
              </Text>
            </Pressable>

            <View style={styles.actions}>
              <Button
                label="Uphold"
                variant="outline"
                disabled={busyIds.includes(item.id)}
                onPress={() =>
                  void decide(item, 'denied', 'Reviewed — the original decision stands.')
                }
                style={styles.action}
              />
              <Button
                label="Overturn"
                loading={busyIds.includes(item.id)}
                onPress={() => confirmGrant(item)}
                style={styles.action}
              />
            </View>

            <Text style={styles.hint}>
              Either way they see the outcome. Deciding here doesn&apos;t change the
              catch or the account — that stays a separate, deliberate step.
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No appeals"
            message="If someone thinks you got a call wrong, it lands here."
          />
        }
      />
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: { padding: Spacing.lg, flexGrow: 1 },
  separator: { height: Spacing.lg },
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  who: { ...Typography.bodyStrong, color: Colors.text, flex: 1 },
  time: { ...Typography.caption, color: Colors.textFaint },
  message: { ...Typography.body, color: Colors.text },
  link: { alignSelf: 'flex-start' },
  linkLabel: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  action: { flex: 1 },
  hint: { ...Typography.caption, color: Colors.textFaint },
}));
