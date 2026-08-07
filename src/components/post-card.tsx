import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { PostMediaView } from '@/components/post-media';
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
  /** Tapping the author opens their profile. Omitted where we're already on it. */
  onPressAuthor?: () => void;
};

export function PostCard({
  post,
  currentUid,
  onPress,
  showStatus = false,
  onPressAuthor,
}: PostCardProps) {
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

  async function sharePost() {
    try {
      // A URL in the message is what makes the share useful in Messages or
      // Facebook; the deep link opens the post for anyone who has the app.
      await Share.share({
        message: `${post.author.username}'s catch on Coop's Custom Baits${
          post.caption ? `: ${post.caption}` : ''
        }`,
        url: post.media.url,
      });
    } catch (error) {
      // The user dismissing the sheet is not an error worth reporting.
      if (error instanceof Error && !/dismiss/i.test(error.message)) {
        Alert.alert('Could not share', error.message);
      }
    }
  }

  const likeCount = Math.max(0, post.likeCount + pendingDelta);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole={onPressAuthor ? 'button' : undefined}
          accessibilityLabel={onPressAuthor ? `${post.author.username}'s profile` : undefined}
          onPress={onPressAuthor}
          disabled={!onPressAuthor}
          style={styles.author}>
          <Avatar uri={post.author.photoURL} name={post.author.username} size={36} />
          <View style={styles.headerText}>
            <Text style={styles.username}>{post.author.username}</Text>
            <Text style={styles.timestamp}>
              {shortTimeAgo(post.publishedAt ?? post.createdAt)}
              {post.species ? ` · ${post.species}` : ''}
            </Text>
          </View>
        </Pressable>
        {showStatus && post.status !== 'approved' ? (
          <Badge
            label={post.status === 'pending' ? 'In review' : 'Not approved'}
            tone={post.status === 'pending' ? 'pending' : 'rejected'}
          />
        ) : null}
      </View>

      {post.media.kind === 'video' ? (
        // Don't wrap a video in a Pressable — the tap has to reach the play
        // button rather than opening the detail screen.
        <PostMediaView media={post.media} />
      ) : (
        <Pressable onPress={onPress} disabled={!onPress}>
          <PostMediaView media={post.media} />
        </Pressable>
      )}

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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share"
            onPress={sharePost}
            hitSlop={8}
            style={[styles.action, styles.shareAction]}>
            <Ionicons name="share-outline" size={20} color={Colors.textMuted} />
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
  author: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
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
  shareAction: {
    marginLeft: 'auto',
  },
});
