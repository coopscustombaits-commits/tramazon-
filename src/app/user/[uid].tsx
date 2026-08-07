import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostCard } from '@/components/post-card';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { EmptyState, ScreenLoader } from '@/components/ui/screen';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';
import { fetchApprovedPostsByAuthor } from '@/lib/db/posts';
import { getUserProfile } from '@/lib/db/users';
import type { Post, UserProfile } from '@/types/models';

/**
 * Another angler's profile: their approved catches only.
 *
 * Pending and rejected posts aren't filtered out here — the security rules
 * refuse the query outright unless it asks for approved posts, so there's no
 * way for them to leak through this screen.
 */
export default function UserProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!uid) return;

    // Viewing your own profile from a comment or the feed should land on the
    // real profile tab, not a read-only copy of it.
    if (user && uid === user.uid) {
      router.replace('/(tabs)/profile');
      return;
    }

    let cancelled = false;
    Promise.all([getUserProfile(uid), fetchApprovedPostsByAuthor(uid)])
      .then(([nextProfile, nextPosts]) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setPosts(nextPosts);
      })
      .catch((error: unknown) => console.warn('[user] could not load profile', error))
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [uid, user, router]);

  if (!loaded) return <ScreenLoader />;

  if (!profile) {
    return (
      <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ title: 'Angler' }} />
        <EmptyState
          title="Angler not found"
          message="This account may have been deleted."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: profile.username }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.profileCard}>
          <Avatar uri={profile.photoURL} name={profile.username} size={80} />
          <Text style={styles.username}>{profile.username}</Text>

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
        </Card>

        {posts.length === 0 ? (
          <Card>
            <Text style={styles.empty}>No catches in the feed yet.</Text>
          </Card>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUid={user?.uid ?? ''}
              onPress={() => router.push(`/post/${post.id}`)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
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
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  profileCard: {
    alignItems: 'center',
    gap: Spacing.md,
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
    paddingTop: Spacing.md,
    borderTopWidth: 1,
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
  empty: {
    ...Typography.caption,
    textAlign: 'center',
  },
});
