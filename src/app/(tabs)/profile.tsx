import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/card';
import { Screen, ScreenLoader } from '@/components/ui/screen';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, isAdmin } = useAuth();

  if (!profile) {
    return <ScreenLoader />;
  }

  return (
    <Screen scroll padded={false} contentContainerStyle={styles.content}>
      <AppHeader
        title="Profile"
        action={{
          icon: 'settings-outline',
          label: 'Settings',
          onPress: () => router.push('/settings'),
        }}
      />

      <View style={styles.body}>
        <Card style={styles.profileCard}>
          <Avatar uri={profile.photoURL} name={profile.username} size={88} />
          <View style={styles.identity}>
            <Text style={styles.username}>{profile.username}</Text>
            {isAdmin ? <Badge label="Admin" tone="approved" /> : null}
          </View>

          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          {profile.favoriteSpecies ? (
            <View style={styles.speciesRow}>
              <Ionicons name="fish-outline" size={16} color={Colors.accent} />
              <Text style={styles.species}>{profile.favoriteSpecies}</Text>
            </View>
          ) : null}

          <View style={styles.stats}>
            <Stat label="Catches" value={profile.postCount} />
            <Stat label="Followers" value={profile.followerCount} />
            <Stat label="Following" value={profile.followingCount} />
          </View>

          <Button
            label="Edit profile"
            variant="outline"
            onPress={() => router.push('/settings/edit-profile')}
          />
        </Card>

        {isAdmin ? (
          <Button
            label="Review pending posts"
            icon="shield-checkmark-outline"
            variant="secondary"
            onPress={() => router.push('/admin/review')}
          />
        ) : null}

        <Card style={styles.placeholderCard}>
          <Text style={styles.placeholderTitle}>Your catches</Text>
          <Text style={styles.placeholderBody}>
            Posts you&apos;ve shared will show up here once the feed is built.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: Spacing.xxl,
  },
  body: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  profileCard: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  identity: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  username: {
    ...Typography.title,
  },
  bio: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  speciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  species: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignSelf: 'stretch',
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    ...Typography.heading,
  },
  statLabel: {
    ...Typography.caption,
  },
  placeholderCard: {
    gap: Spacing.xs,
  },
  placeholderTitle: {
    ...Typography.heading,
  },
  placeholderBody: {
    ...Typography.caption,
  },
});
