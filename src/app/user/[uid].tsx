import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostCard } from '@/components/post-card';
import { ReportSheet } from '@/components/report-sheet';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { EmptyState, ScreenLoader } from '@/components/ui/screen';
import { Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { useBlocked } from '@/lib/db/blocked-context';
import { followUser, subscribeToIsFollowing, unfollowUser } from '@/lib/db/follows';
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
  const Colors = useThemeColors();
  const styles = useStyles();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { isBlocked, block, unblock } = useBlocked();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [reporting, setReporting] = useState(false);

  // Live, so the button matches reality if they follow from another screen.
  useEffect(() => {
    if (!user || !uid || user.uid === uid) return;
    return subscribeToIsFollowing(user.uid, uid, setFollowing);
  }, [user, uid]);

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

  async function toggleFollow() {
    if (!user || !uid) return;
    const next = !following;
    setFollowing(next);
    setFollowBusy(true);
    try {
      if (next) {
        await followUser(user.uid, uid);
      } else {
        await unfollowUser(user.uid, uid);
      }
    } catch (error) {
      setFollowing(!next);
      console.warn('[user] follow toggle failed', error);
    } finally {
      setFollowBusy(false);
    }
  }

  function confirmBlock() {
    if (!profile) return;
    const blocked = isBlocked(profile.uid);

    Alert.alert(
      blocked ? `Unblock ${profile.username}?` : `Block ${profile.username}?`,
      blocked
        ? 'Their catches and comments will show up again.'
        : "You won't see their catches or comments. They aren't told.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: blocked ? 'Unblock' : 'Block',
          style: blocked ? 'default' : 'destructive',
          onPress: async () => {
            try {
              if (blocked) {
                await unblock(profile.uid);
              } else {
                await block({ uid: profile.uid, username: profile.username });
              }
            } catch (error) {
              console.warn('[user] block toggle failed', error);
            }
          },
        },
      ],
    );
  }

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
      <Stack.Screen
        options={{
          title: profile.username,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`More options for ${profile.username}`}
              hitSlop={8}
              onPress={() =>
                Alert.alert(profile.username, undefined, [
                  { text: 'Report this angler', onPress: () => setReporting(true) },
                  {
                    text: isBlocked(profile.uid) ? 'Unblock' : 'Block',
                    style: isBlocked(profile.uid) ? 'default' : 'destructive',
                    onPress: confirmBlock,
                  },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }>
              <Ionicons name="ellipsis-horizontal" size={22} color={Colors.primary} />
            </Pressable>
          ),
        }}
      />

      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        targetType="user"
        targetId={profile.uid}
        targetOwnerId={profile.uid}
        targetLabel={profile.username}
      />

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
            <Stat label="Posts" value={profile.postCount} />
            <Stat label="Fish logged" value={profile.fishLoggedCount ?? 0} />
            <Stat label="Followers" value={profile.followerCount} />
          </View>

          <Button
            label={following ? 'Following' : 'Follow'}
            icon={following ? 'checkmark' : 'person-add-outline'}
            variant={following ? 'outline' : 'primary'}
            onPress={toggleFollow}
            disabled={followBusy}
          />
        </Card>

        {isBlocked(profile.uid) ? (
          <Card>
            <Text style={styles.empty}>
              You&apos;ve blocked {profile.username}. Their catches are hidden from your
              feed.
            </Text>
          </Card>
        ) : null}

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
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
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
}));
