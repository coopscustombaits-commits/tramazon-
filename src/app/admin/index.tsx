import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, Divider, ListRow, SectionHeader } from '@/components/ui/card';
import { Screen, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { subscribeToGlobalStats } from '@/lib/db/admin';
import { subscribeToPendingPosts } from '@/lib/db/posts';
import { subscribeToOpenReports } from '@/lib/db/safety';
import type { GlobalStats } from '@/types/models';

/**
 * The dashboard — Coop's home screen for running the place.
 *
 * The tiles read from `stats/global`, which Cloud Functions increment as
 * things happen. The two queue counts are subscribed live instead, because
 * "how many are waiting for me right now" is the number that has to be
 * correct to the second, and both queues are small enough to count directly.
 */
export default function AdminDashboardScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { isAdmin, status } = useAuth();

  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [pending, setPending] = useState(0);
  const [reports, setReports] = useState(0);

  useEffect(() => {
    if (status === 'signed-in' && !isAdmin) router.replace('/(tabs)');
  }, [isAdmin, status, router]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeToGlobalStats(setStats, (error) =>
      console.warn('[admin] stats failed', error),
    );
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeToPendingPosts((posts) => setPending(posts.length));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeToOpenReports((open) => setReports(open.length));
  }, [isAdmin]);

  if (!isAdmin) return <ScreenLoader />;

  return (
    <Screen scroll padded={false} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <View style={styles.tiles}>
          <Tile
            label="Waiting for review"
            value={pending}
            icon="shield-checkmark-outline"
            tone={pending > 0 ? 'alert' : 'calm'}
            onPress={() => router.push('/admin/review')}
          />
          <Tile
            label="Open reports"
            value={reports}
            icon="flag-outline"
            tone={reports > 0 ? 'alert' : 'calm'}
            onPress={() => router.push('/admin/reports')}
          />
        </View>

        <View style={styles.tiles}>
          <Tile label="Anglers" value={stats?.userCount ?? 0} icon="people-outline" />
          <Tile
            label="Catches live"
            value={stats?.approvedPostCount ?? 0}
            icon="fish-outline"
          />
        </View>

        {stats === null ? (
          <Text style={styles.note}>
            Totals start counting once the Cloud Functions are deployed and the first
            angler signs up.
          </Text>
        ) : null}

        <SectionHeader title="Moderate" />
        <Card style={styles.card}>
          <ListRow
            label="Review queue"
            description="Approve or reject pending catches"
            icon="shield-checkmark-outline"
            onPress={() => router.push('/admin/review')}
          />
          <Divider />
          <ListRow
            label="Reports"
            description="Content flagged by anglers"
            icon="flag-outline"
            onPress={() => router.push('/admin/reports')}
          />
          <Divider />
          <ListRow
            label="Appeals"
            description="Decisions anglers have asked you to revisit"
            icon="hand-right-outline"
            onPress={() => router.push('/admin/appeals')}
          />
          <Divider />
          <ListRow
            label="Anglers"
            description="Find someone, suspend or reinstate"
            icon="people-outline"
            onPress={() => router.push('/admin/users')}
          />
        </Card>

        <SectionHeader title="Publish" />
        <Card style={styles.card}>
          <ListRow
            label="Announcement"
            description="Push a message to everyone"
            icon="megaphone-outline"
            onPress={() => router.push('/admin/announce')}
          />
          <Divider />
          <ListRow
            label="Tips & videos"
            icon="book-outline"
            onPress={() => router.push('/admin/articles')}
          />
          <Divider />
          <ListRow
            label="Challenges & tournaments"
            icon="trophy-outline"
            onPress={() => router.push('/admin/competitions')}
          />
          <Divider />
          <ListRow
            label="Calendar"
            icon="calendar-outline"
            onPress={() => router.push('/admin/events')}
          />
          <Divider />
          <ListRow
            label="Badges"
            icon="ribbon-outline"
            onPress={() => router.push('/admin/badges')}
          />
        </Card>

        <SectionHeader title="Settings" />
        <Card style={styles.card}>
          <ListRow
            label="App controls"
            description="Maintenance mode, pause posting or DMs"
            icon="options-outline"
            onPress={() => router.push('/admin/config')}
          />
        </Card>

        <Text style={styles.footer}>
          Anything on this screen is admin-only because your uid has an `admins`
          document. The security rules check that on the server, so the screens are a
          convenience, not the lock.
        </Text>
      </View>
    </Screen>
  );
}

function Tile({
  label,
  value,
  icon,
  tone = 'calm',
  onPress,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'calm' | 'alert';
  onPress?: () => void;
}) {
  const Colors = useThemeColors();
  const styles = useStyles();
  const alert = tone === 'alert';

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${value}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        alert && styles.tileAlert,
        pressed && onPress && styles.tilePressed,
      ]}>
      <Ionicons name={icon} size={18} color={alert ? Colors.danger : Colors.primary} />
      <Text style={[styles.tileValue, alert && styles.tileValueAlert]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  section: { gap: Spacing.md },
  card: { padding: 0 },
  tiles: { flexDirection: 'row', gap: Spacing.md },
  tile: {
    flex: 1,
    gap: Spacing.xs,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tileAlert: { borderColor: Colors.danger },
  tilePressed: { opacity: 0.85 },
  tileValue: { ...Typography.title, color: Colors.text },
  tileValueAlert: { color: Colors.danger },
  tileLabel: { ...Typography.caption, color: Colors.textMuted },
  note: { ...Typography.caption, color: Colors.textMuted },
  footer: {
    ...Typography.caption,
    color: Colors.textFaint,
    marginTop: Spacing.lg,
  },
}));
