import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostCard } from '@/components/post-card';
import { AppealSheet } from '@/components/appeal-sheet';
import { ReportSheet } from '@/components/report-sheet';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { useBlocked } from '@/lib/db/blocked-context';
import { authErrorMessage } from '@/lib/auth/errors';
import {
  COMMENT_MAX,
  addComment,
  deleteComment,
  deletePost,
  rejectPost,
  setFeatured,
  subscribeToComments,
  subscribeToPost,
} from '@/lib/db/posts';
import { shortTimeAgo } from '@/lib/format';
import type { Post, PostComment } from '@/types/models';

export default function PostDetailScreen() {
  const Colors = useThemeColors();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, profile, isAdmin } = useAuth();
  const { filterBlocked, isBlocked, block, unblock } = useBlocked();

  const [post, setPost] = useState<Post | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  /** What the report sheet is currently pointed at, if open. */
  const [appealing, setAppealing] = useState(false);
  const [reportTarget, setReportTarget] = useState<
    { type: 'post' | 'comment'; id: string; ownerId: string; label: string } | null
  >(null);

  useEffect(() => {
    if (!id) return;
    return subscribeToPost(
      id,
      (next) => {
        setPost(next);
        setLoaded(true);
      },
      () => setLoaded(true),
    );
  }, [id]);

  useEffect(() => {
    // Comments only exist on approved posts, and the rules deny reading them
    // otherwise — don't open a subscription that will just error.
    if (!id || post?.status !== 'approved') return;
    return subscribeToComments(id, setComments, (error) =>
      console.warn('[post] comments failed', error),
    );
  }, [id, post?.status]);

  async function submitComment() {
    if (!id || !profile || !draft.trim()) return;
    setSending(true);
    try {
      await addComment(id, profile, draft);
      setDraft('');
    } catch (caught) {
      Alert.alert('Could not post comment', authErrorMessage(caught));
    } finally {
      setSending(false);
    }
  }

  function confirmDeleteComment(comment: PostComment) {
    Alert.alert('Delete comment', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          try {
            await deleteComment(id, comment.id);
          } catch (caught) {
            Alert.alert('Could not delete', authErrorMessage(caught));
          }
        },
      },
    ]);
  }

  function confirmDeletePost() {
    if (!post) return;
    Alert.alert('Delete post', 'This removes the post and its photo for good.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(post);
            router.back();
          } catch (caught) {
            Alert.alert('Could not delete', authErrorMessage(caught));
          }
        },
      },
    ]);
  }

  if (!loaded) {
    return <ScreenLoader />;
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ title: 'Catch' }} />
        <EmptyState
          title="Post not found"
          message="It may have been removed, or it hasn't been approved yet."
        />
      </SafeAreaView>
    );
  }

  const canDeletePost = post.authorId === user?.uid || isAdmin;
  // Only the author, and only once a decision has actually gone against them.
  const canAppeal = post.authorId === user?.uid && post.status === 'rejected';
  const canComment = post.status === 'approved' && Boolean(profile);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: post.author.username,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Post options"
              hitSlop={8}
              onPress={() => {
                const options: {
                  text: string;
                  style?: 'destructive' | 'cancel';
                  onPress?: () => void;
                }[] = [];

                if (post.authorId !== user?.uid) {
                  options.push({
                    text: 'Report this catch',
                    onPress: () =>
                      setReportTarget({
                        type: 'post',
                        id: post.id,
                        ownerId: post.authorId,
                        label: 'this catch',
                      }),
                  });
                  options.push({
                    text: isBlocked(post.authorId)
                      ? `Unblock ${post.author.username}`
                      : `Block ${post.author.username}`,
                    style: isBlocked(post.authorId) ? undefined : 'destructive',
                    onPress: () => {
                      if (isBlocked(post.authorId)) {
                        void unblock(post.authorId);
                      } else {
                        void block({
                          uid: post.authorId,
                          username: post.author.username,
                        });
                      }
                    },
                  });
                }

                if (canAppeal) {
                  options.push({
                    text: 'Appeal this decision',
                    onPress: () => setAppealing(true),
                  });
                }

                if (isAdmin && post.status === 'approved') {
                  options.push({
                    text: post.featured ? 'Unpin from the feed' : 'Pin to the top of the feed',
                    onPress: () => {
                      void setFeatured(post.id, !post.featured).catch((caught: unknown) =>
                        Alert.alert('Could not change that', authErrorMessage(caught)),
                      );
                    },
                  });
                  options.push({
                    // Taking a live catch down without deleting it: the author
                    // keeps it on their own profile, marked rejected, and the
                    // post count and points come back off.
                    text: 'Take down (reject)',
                    style: 'destructive',
                    onPress: () => {
                      Alert.alert(
                        'Take this catch down?',
                        'It leaves the feed. The author still sees it on their profile, marked rejected.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Take down',
                            style: 'destructive',
                            onPress: () => {
                              if (!user) return;
                              void rejectPost(post.id, user.uid, 'Taken down after a report')
                                .catch((caught: unknown) =>
                                  Alert.alert('Could not take it down', authErrorMessage(caught)),
                                );
                            },
                          },
                        ],
                      );
                    },
                  });
                }

                if (canDeletePost) {
                  options.push({
                    text: 'Delete post',
                    style: 'destructive',
                    onPress: confirmDeletePost,
                  });
                }

                options.push({ text: 'Cancel', style: 'cancel' });
                Alert.alert(post.author.username, undefined, options);
              }}>
              <Ionicons name="ellipsis-horizontal" size={22} color={Colors.primary} />
            </Pressable>
          ),
        }}
      />

      {appealing ? (
        <AppealSheet
          visible
          onClose={() => setAppealing(false)}
          kind="post"
          targetId={post.id}
          what="this catch"
        />
      ) : null}

      {reportTarget ? (
        <ReportSheet
          visible
          onClose={() => setReportTarget(null)}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          targetOwnerId={reportTarget.ownerId}
          parentId={reportTarget.type === 'comment' ? post.id : null}
          targetLabel={reportTarget.label}
        />
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <FlatList
          data={filterBlocked(comments)}
          keyExtractor={(comment) => comment.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.header}>
              <PostCard
                post={post}
                currentUid={user?.uid ?? ''}
                showStatus
                onPressAuthor={() => router.push(`/user/${post.authorId}`)}
              />
              {post.status === 'approved' ? (
                <Text style={styles.commentsHeading}>Comments</Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <CommentRow
              comment={item}
              canDelete={item.authorId === user?.uid || post.authorId === user?.uid || isAdmin}
              onDelete={() => confirmDeleteComment(item)}
              onPressAuthor={() => router.push(`/user/${item.authorId}`)}
              onReport={
                item.authorId === user?.uid
                  ? undefined
                  : () =>
                      setReportTarget({
                        type: 'comment',
                        id: item.id,
                        ownerId: item.authorId,
                        label: `${item.author.username}'s comment`,
                      })
              }
            />
          )}
          ListEmptyComponent={
            post.status === 'approved' ? (
              <Text style={styles.noComments}>No comments yet. Say something nice.</Text>
            ) : null
          }
        />

        {canComment ? (
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment..."
              placeholderTextColor={Colors.textFaint}
              maxLength={COMMENT_MAX}
              multiline
              editable={!sending}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Post comment"
              onPress={submitComment}
              disabled={sending || !draft.trim()}
              style={({ pressed }) => [
                styles.send,
                (sending || !draft.trim()) && styles.sendDisabled,
                pressed && styles.sendPressed,
              ]}>
              <Ionicons name="arrow-up" size={20} color={Colors.textInverse} />
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CommentRow({
  comment,
  canDelete,
  onDelete,
  onPressAuthor,
  onReport,
}: {
  comment: PostComment;
  canDelete: boolean;
  onDelete: () => void;
  onPressAuthor: () => void;
  /** Omitted on your own comments — reporting yourself is meaningless. */
  onReport?: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Long press for options"
      onLongPress={() => {
        const options: {
          text: string;
          style?: 'destructive' | 'cancel';
          onPress?: () => void;
        }[] = [];
        if (onReport) options.push({ text: 'Report this comment', onPress: onReport });
        if (canDelete) {
          options.push({ text: 'Delete comment', style: 'destructive', onPress: onDelete });
        }
        if (options.length === 0) return;
        options.push({ text: 'Cancel', style: 'cancel' });
        Alert.alert(comment.author.username, undefined, options);
      }}
      delayLongPress={400}
      style={styles.comment}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${comment.author.username}'s profile`}
        onPress={onPressAuthor}>
        <Avatar uri={comment.author.photoURL} name={comment.author.username} size={32} />
      </Pressable>
      <View style={styles.commentBody}>
        <Text style={styles.commentMeta}>
          {comment.author.username}
          <Text style={styles.commentTime}> · {shortTimeAgo(comment.createdAt)}</Text>
        </Text>
        <Text style={styles.commentText}>{comment.text}</Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  list: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  header: {
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  commentsHeading: {
    ...Typography.label,
  },
  noComments: {
    ...Typography.caption,
    paddingVertical: Spacing.lg,
  },
  comment: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  commentBody: {
    flex: 1,
    gap: 2,
  },
  commentMeta: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.text,
  },
  commentTime: {
    fontWeight: '400',
    color: Colors.textMuted,
  },
  commentText: {
    ...Typography.body,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    fontSize: 15,
    color: Colors.text,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.4,
  },
  sendPressed: {
    opacity: 0.8,
  },
}));
