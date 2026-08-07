import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { PostCard } from '@/components/post-card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/card';
import { Screen, ScreenLoader } from '@/components/ui/screen';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';
import { fetchPostsByAuthor } from '@/lib/db/posts';
import type { Post } from '@/types/models';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, isAdmin } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const uid = profile?.uid;

  // Refetch whenever the tab comes back into focus, so a catch submitted a
  // moment ago is already here.
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let cancelled = false;
      void fetchPostsByAuthor(uid)
        .then((result) => {
          if (!cancelled) setPosts(result);
        })
        .catch((error) => console.warn('[profile] could not load posts', error))
        .finally(() => {
          if (!cancelled) setLoadingPosts(false);
        });
      return () => {
        cancelled = true;
      };
    }, [uid]),
  );

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

        <View style={styles.postsSection}>
          <Text style={styles.postsHeading}>Your catches</Text>
          {loadingPosts ? (
            <ActivityIndicator color={Colors.primary} style={styles.postsLoader} />
          ) : posts.length === 0 ? (
            <Card style={styles.placeholderCard}>
              <Text style={styles.placeholderBody}>
                Nothing yet. Post a photo of your catch and it&apos;ll show up here —
                pending until Coop approves it.
              </Text>
            </Card>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUid={profile.uid}
                showStatus
                onPress={() => router.push(`/post/${post.id}`)}
              />
            ))
          )}
        </View>
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
  postsSection: {
    gap: Spacing.md,
  },
  postsHeading: {
    ...Typography.label,
  },
  postsLoader: {
    paddingVertical: Spacing.xl,
  },
  placeholderCard: {
    gap: Spacing.xs,
  },
  placeholderBody: {
    ...Typography.caption,
  },
});
