import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { ThemePicker } from '@/components/theme-picker';
import { Card, Divider, ListRow, SectionHeader } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';

export default function SettingsScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { profile, user, isAdmin, signOut, deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);

  function confirmSignOut() {
    Alert.alert('Log out', 'You can log back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await signOut();
          } catch (error) {
            Alert.alert('Could not log out', authErrorMessage(error));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This permanently deletes your profile, your posts, and your photos. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteAccount();
            } catch (error) {
              // Includes the "log out and log back in" case — Firebase won't
              // delete an account on a stale session.
              Alert.alert('Could not delete account', authErrorMessage(error));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen scroll padded={false} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <SectionHeader title="Account" />
        <Card style={styles.card}>
          <ListRow
            label="Edit profile"
            description={profile?.username ?? undefined}
            icon="person-outline"
            onPress={() => router.push('/settings/edit-profile')}
          />
          <Divider />
          <ListRow
            label="Notifications"
            description="Choose what you get pinged about"
            icon="notifications-outline"
            onPress={() => router.push('/settings/notifications')}
          />
          <Divider />
          <ListRow
            label="Email"
            description={user?.email ?? 'Signed in with Google or Apple'}
            icon="mail-outline"
          />
        </Card>

        <SectionHeader title="Appearance" />
        <Card style={styles.card}>
          <ThemePicker />
        </Card>

        <SectionHeader title="Learn" />
        <Card style={styles.card}>
          <ListRow
            label="Tips & videos"
            description="How-tos from Coop, and his YouTube uploads"
            icon="book-outline"
            onPress={() => router.push('/learn')}
          />
          <Divider />
          <ListRow
            label="Bait reviews"
            description="What the community says actually works"
            icon="star-outline"
            onPress={() => router.push('/baits')}
          />
          <Divider />
          <ListRow
            label="Calendar"
            description="Tournament dates, drops, and meet-ups"
            icon="calendar-outline"
            onPress={() => router.push('/events')}
          />
          <Divider />
          <ListRow
            label="Leaderboard"
            description="Top anglers, and how points work"
            icon="podium-outline"
            onPress={() => router.push('/leaderboard')}
          />
          <Divider />
          <ListRow
            label="Challenges & tournaments"
            description="What's running, and the leaderboards"
            icon="trophy-outline"
            onPress={() => router.push('/compete')}
          />
          <Divider />
          <ListRow
            label="Species hubs"
            description="Catches by fish"
            icon="fish-outline"
            onPress={() => router.push('/species')}
          />
        </Card>

        <SectionHeader title="Shop" />
        <Card style={styles.card}>
          <ListRow
            label="Your orders"
            description="Order status and tracking"
            icon="cube-outline"
            onPress={() => router.push('/orders')}
          />
          <Divider />
          <ListRow
            label="Wishlist"
            description="Baits you've saved"
            icon="heart-outline"
            onPress={() => router.push('/wishlist')}
          />
        </Card>

        {isAdmin ? (
          <>
            <SectionHeader title="Admin" />
            <Card style={styles.card}>
              <ListRow
                label="Review queue"
                description="Approve or reject pending posts"
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
                label="Calendar"
                description="Add dates anglers should know about"
                icon="calendar-outline"
                onPress={() => router.push('/admin/events')}
              />
              <Divider />
              <ListRow
                label="Badges"
                description="What anglers can earn, and the thresholds"
                icon="ribbon-outline"
                onPress={() => router.push('/admin/badges')}
              />
              <Divider />
              <ListRow
                label="Challenges & tournaments"
                description="Start one, or declare a winner"
                icon="trophy-outline"
                onPress={() => router.push('/admin/competitions')}
              />
              <Divider />
              <ListRow
                label="Tips & videos"
                description="Write a tip or add a YouTube video"
                icon="book-outline"
                onPress={() => router.push('/admin/articles')}
              />
              <Divider />
              <ListRow
                label="Send an announcement"
                description="Push a message to everyone"
                icon="megaphone-outline"
                onPress={() => router.push('/admin/announce')}
              />
            </Card>
          </>
        ) : null}

        <SectionHeader title="Coop's Custom Baits" />
        <Card style={styles.card}>
          <ListRow
            label="About"
            icon="information-circle-outline"
            onPress={() => router.push('/settings/about')}
          />
          <Divider />
          <ListRow
            label="Contact & support"
            icon="chatbubble-ellipses-outline"
            onPress={() => router.push('/settings/contact')}
          />
          <Divider />
          <ListRow
            label="Privacy & your data"
            icon="lock-closed-outline"
            onPress={() => router.push('/settings/privacy')}
          />
          <Divider />
          <ListRow
            label="Blocked anglers"
            description="People whose catches you don't see"
            icon="hand-left-outline"
            onPress={() => router.push('/settings/blocked')}
          />
        </Card>

        <SectionHeader title="Session" />
        <Card style={styles.card}>
          <ListRow
            label="Log out"
            icon="log-out-outline"
            onPress={busy ? undefined : confirmSignOut}
          />
          <Divider />
          <ListRow
            label="Delete account"
            description="Permanently removes your account and posts"
            icon="trash-outline"
            destructive
            onPress={busy ? undefined : confirmDeleteAccount}
          />
        </Card>

        <Text style={styles.version}>Version {appVersion}</Text>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  content: {
    paddingBottom: Spacing.xxl,
  },
  section: {
    paddingHorizontal: Spacing.xl,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
    borderRadius: Radius.lg,
  },
  version: {
    ...Typography.caption,
    color: Colors.textFaint,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
}));
