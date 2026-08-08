import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { Badge } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { fetchMessageForReview, removeMessage } from '@/lib/db/messages';
import { REPORT_REASONS, resolveReport, subscribeToOpenReports } from '@/lib/db/safety';
import { shortTimeAgo } from '@/lib/format';
import type { Report } from '@/types/models';

const REASON_LABELS = new Map(REPORT_REASONS.map((r) => [r.value, r.label]));

const TARGET_LABELS: Record<Report['targetType'], string> = {
  post: 'Catch',
  comment: 'Comment',
  user: 'Angler',
  message: 'Message',
};

/**
 * Admin-only queue of everything anglers have flagged.
 *
 * Deliberately doesn't show who filed the report in the list — that keeps a
 * glance at the screen from identifying a reporter to anyone nearby.
 */
export default function AdminReportsScreen() {
  const router = useRouter();
  const { isAdmin, status, user } = useAuth();
  const styles = useStyles();

  const [reports, setReports] = useState<Report[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyIds, setBusyIds] = useState<string[]>([]);

  useEffect(() => {
    if (status === 'signed-in' && !isAdmin) router.replace('/(tabs)');
  }, [isAdmin, status, router]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeToOpenReports(
      (next) => {
        setReports(next);
        setLoaded(true);
      },
      (error) => {
        console.warn('[reports] queue failed', error);
        setLoaded(true);
      },
    );
  }, [isAdmin]);

  async function resolve(report: Report, decision: 'actioned' | 'dismissed') {
    if (!user) return;
    setBusyIds((current) => [...current, report.id]);
    try {
      await resolveReport(report.id, user.uid, decision);
    } catch (error) {
      Alert.alert('Could not update the report', authErrorMessage(error));
    } finally {
      setBusyIds((current) => current.filter((id) => id !== report.id));
    }
  }

  function open(report: Report) {
    if (report.targetType === 'post') {
      router.push(`/post/${report.targetId}`);
    } else if (report.targetType === 'comment' && report.parentId) {
      router.push(`/post/${report.parentId}`);
    } else if (report.targetType === 'user') {
      router.push(`/user/${report.targetId}`);
    } else if (report.targetType === 'message' && report.parentId) {
      void reviewMessage(report);
    }
  }

  /**
   * A reported message can't just be opened — a DM thread is private, and
   * dropping an admin into it would look, to the two people in it, exactly
   * like a third participant. Instead the message is fetched on its own and
   * shown in an alert with the one action that matters.
   */
  async function reviewMessage(report: Report) {
    if (!report.parentId || !user) return;
    try {
      const message = await fetchMessageForReview(report.parentId, report.targetId);
      if (!message) {
        Alert.alert('Gone', 'That message has already been deleted.');
        return;
      }
      if (message.removedAt) {
        Alert.alert('Already removed', 'You have already taken this one down.');
        return;
      }

      Alert.alert(
        'Reported message',
        `"${message.text}"`,
        [
          { text: 'Leave it', style: 'cancel' },
          {
            text: 'Remove it',
            style: 'destructive',
            onPress: () => {
              void removeMessage(report.parentId!, report.targetId, user.uid)
                .then(() =>
                  Alert.alert(
                    'Removed',
                    'Both people now see "This message was removed." The thread keeps its shape, so this report stays auditable.',
                  ),
                )
                .catch((error: unknown) =>
                  Alert.alert('Could not remove it', authErrorMessage(error)),
                );
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert('Could not read that message', authErrorMessage(error));
    }
  }

  if (!isAdmin || !loaded) return <ScreenLoader />;

  return (
    <Screen padded={false}>
      <FlatList
        data={reports}
        keyExtractor={(report) => report.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.header}>
              <Badge label={TARGET_LABELS[item.targetType]} tone="pending" />
              <Text style={styles.time}>{shortTimeAgo(item.createdAt)}</Text>
            </View>

            <Text style={styles.reason}>
              {REASON_LABELS.get(item.reason) ?? item.reason}
            </Text>
            {item.note ? <Text style={styles.note}>&ldquo;{item.note}&rdquo;</Text> : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => open(item)}
              hitSlop={8}
              style={styles.link}>
              <Text style={styles.linkLabel}>
                {item.targetType === 'message'
                  ? 'Read the reported message'
                  : 'Open the reported content'}
              </Text>
            </Pressable>

            <View style={styles.actions}>
              <Button
                label="Dismiss"
                variant="outline"
                onPress={() => void resolve(item, 'dismissed')}
                disabled={busyIds.includes(item.id)}
                style={styles.action}
              />
              <Button
                label="Handled"
                onPress={() => void resolve(item, 'actioned')}
                loading={busyIds.includes(item.id)}
                style={styles.action}
              />
            </View>

            <Text style={styles.hint}>
              {item.targetType === 'message'
                ? 'Reading the message lets you remove it. Suspending the sender is on Dashboard → Anglers.'
                : 'Taking the catch down, pinning it, or suspending the angler is done on their own screen — this just clears the report.'}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Nothing reported"
            message="Anything anglers flag will land here, and you'll get a notification."
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
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  time: { ...Typography.caption, color: Colors.textMuted },
  reason: { ...Typography.bodyStrong, color: Colors.text },
  note: { ...Typography.body, color: Colors.textMuted, fontStyle: 'italic' },
  link: { alignSelf: 'flex-start' },
  linkLabel: { ...Typography.body, color: Colors.link, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
  action: { flex: 1 },
  hint: { ...Typography.caption, color: Colors.textFaint },
}));
