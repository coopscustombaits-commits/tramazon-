import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { approvePost, rejectPost, subscribeToPendingPosts } from '@/lib/db/posts';
import { plural, shortTimeAgo } from '@/lib/format';
import type { Post } from '@/types/models';

/**
 * Admin-only review queue.
 *
 * This screen hides itself from non-admins, but that's only a courtesy — the
 * real guarantee is in firestore.rules, which is what an attacker can't
 * bypass by editing the app.
 */
export default function AdminReviewScreen() {
  const router = useRouter();
  const { isAdmin, status, user } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** Post ids currently being approved or rejected, so buttons can't double-fire. */
  const [busyIds, setBusyIds] = useState<string[]>([]);

  useEffect(() => {
    if (status === 'signed-in' && !isAdmin) {
      router.replace('/(tabs)');
    }
  }, [isAdmin, status, router]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeToPendingPosts(
      (pending) => {
        setPosts(pending);
        setLoaded(true);
      },
      (error) => {
        console.warn('[review] queue failed', error);
        setLoaded(true);
      },
    );
  }, [isAdmin]);

  async function review(post: Post, action: 'approve' | 'reject') {
    if (!user) return;
    setBusyIds((current) => [...current, post.id]);
    try {
      if (action === 'approve') {
        await approvePost(post.id, user.uid);
      } else {
        await rejectPost(post.id, user.uid);
      }
      // The post drops out of the live query on its own.
    } catch (caught) {
      Alert.alert('Could not update the post', authErrorMessage(caught));
    } finally {
      setBusyIds((current) => current.filter((id) => id !== post.id));
    }
  }

  function confirmReject(post: Post) {
    Alert.alert(
      'Reject this catch?',
      `It won't appear in the feed. ${post.author.username} keeps it on their own profile marked as not approved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => void review(post, 'reject') },
      ],
    );
  }

  if (!isAdmin || !loaded) {
    return <ScreenLoader />;
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          posts.length > 0 ? (
            <Text style={styles.count}>{plural(posts.length, 'catch', 'catches')} waiting</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <ReviewCard
            post={item}
            busy={busyIds.includes(item.id)}
            onApprove={() => void review(item, 'approve')}
            onReject={() => confirmReject(item)}
            onPressAuthor={() => router.push(`/user/${item.authorId}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Queue is clear"
            message="Nothing waiting for review. You'll get a push notification when someone posts a catch."
          />
        }
      />
    </Screen>
  );
}

function ReviewCard({
  post,
  busy,
  onApprove,
  onReject,
  onPressAuthor,
}: {
  post: Post;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onPressAuthor: () => void;
}) {
  const aspectRatio =
    post.image.width && post.image.height ? post.image.width / post.image.height : 1;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${post.author.username}'s profile`}
        onPress={onPressAuthor}
        style={styles.header}>
        <Avatar uri={post.author.photoURL} name={post.author.username} size={36} />
        <View style={styles.headerText}>
          <Text style={styles.username}>{post.author.username}</Text>
          <Text style={styles.timestamp}>
            Submitted {shortTimeAgo(post.createdAt)} ago
            {post.species ? ` · ${post.species}` : ''}
          </Text>
        </View>
      </Pressable>

      <Image
        source={{ uri: post.image.url }}
        style={[styles.image, { aspectRatio: Math.min(Math.max(aspectRatio, 0.6), 1.6) }]}
        contentFit="cover"
        transition={200}
        accessibilityIgnoresInvertColors
      />

      {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}

      <View style={styles.actions}>
        <Button
          label="Reject"
          variant="danger"
          icon="close"
          onPress={onReject}
          disabled={busy}
          style={styles.actionButton}
        />
        <Button
          label="Approve"
          icon="checkmark"
          onPress={onApprove}
          loading={busy}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    flexGrow: 1,
  },
  count: {
    ...Typography.label,
    marginBottom: Spacing.md,
  },
  separator: {
    height: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  username: {
    ...Typography.bodyStrong,
  },
  timestamp: {
    ...Typography.caption,
  },
  image: {
    width: '100%',
    backgroundColor: Colors.surfaceMuted,
  },
  caption: {
    ...Typography.body,
    padding: Spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    paddingTop: 0,
  },
  actionButton: {
    flex: 1,
  },
});
