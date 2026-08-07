import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/card';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { setLike, subscribeToLike } from '@/lib/db/posts';
import { plural, shortTimeAgo } from '@/lib/format';
import type { Post } from '@/types/models';

type PostCardProps = {
  post: Post;
  /** The signed-in user, so we know whether they've liked it. */
  currentUid: string;
  onPress?: () => void;
  /** Shows the pending/rejected badge — used on your own profile. */
  showStatus?: boolean;
};

export function PostCard({ post, currentUid, onPress, showStatus = false }: PostCardProps) {
  const [liked, setLiked] = useState(false);
  /** Local offset so the count moves the instant you tap, before the Cloud
   * Function has updated `likeCount`. */
  const [pendingDelta, setPendingDelta] = useState(0);

  useEffect(() => {
    if (post.status !== 'approved') return;
    return subscribeToLike(post.id, currentUid, (isLiked) => {
      setLiked(isLiked);
      setPendingDelta(0);
    });
  }, [post.id, post.status, currentUid]);

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setPendingDelta(next ? 1 : -1);
    try {
      await setLike(post.id, currentUid, next);
    } catch {
      // Put it back the way it was; the server said no.
      setLiked(!next);
      setPendingDelta(0);
    }
  }

  const likeCount = Math.max(0, post.likeCount + pendingDelta);
  const aspectRatio =
    post.image.width && post.image.height ? post.image.width / post.image.height : 1;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar uri={post.author.photoURL} name={post.author.username} size={36} />
        <View style={styles.headerText}>
          <Text style={styles.username}>{post.author.username}</Text>
          <Text style={styles.timestamp}>
            {shortTimeAgo(post.publishedAt ?? post.createdAt)}
            {post.species ? ` · ${post.species}` : ''}
          </Text>
        </View>
        {showStatus && post.status !== 'approved' ? (
          <Badge
            label={post.status === 'pending' ? 'In review' : 'Not approved'}
            tone={post.status === 'pending' ? 'pending' : 'rejected'}
          />
        ) : null}
      </View>

      <Pressable onPress={onPress} disabled={!onPress}>
        <Image
          source={{ uri: post.image.url }}
          style={[styles.image, { aspectRatio: Math.min(Math.max(aspectRatio, 0.6), 1.6) }]}
          contentFit="cover"
          transition={200}
          accessibilityIgnoresInvertColors
        />
      </Pressable>

      {post.caption ? (
        <Text style={styles.caption} numberOfLines={onPress ? 3 : undefined}>
          {post.caption}
        </Text>
      ) : null}

      {post.status === 'approved' ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={liked ? 'Unlike' : 'Like'}
            onPress={toggleLike}
            hitSlop={8}
            style={styles.action}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={22}
              color={liked ? Colors.danger : Colors.textMuted}
            />
            <Text style={styles.actionLabel}>{plural(likeCount, 'like')}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Comments"
            onPress={onPress}
            disabled={!onPress}
            hitSlop={8}
            style={styles.action}>
            <Ionicons name="chatbubble-outline" size={20} color={Colors.textMuted} />
            <Text style={styles.actionLabel}>{plural(post.commentCount, 'comment')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.xl,
    padding: Spacing.md,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionLabel: {
    ...Typography.caption,
    fontWeight: '600',
  },
});
