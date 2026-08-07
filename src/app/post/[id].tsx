import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostCard } from '@/components/post-card';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState, ScreenLoader } from '@/components/ui/screen';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import {
  COMMENT_MAX,
  addComment,
  deleteComment,
  deletePost,
  subscribeToComments,
  subscribeToPost,
} from '@/lib/db/posts';
import { shortTimeAgo } from '@/lib/format';
import type { Post, PostComment } from '@/types/models';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, profile, isAdmin } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

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
  const canComment = post.status === 'approved' && Boolean(profile);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: post.author.username,
          headerRight: canDeletePost
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete post"
                  hitSlop={8}
                  onPress={confirmDeletePost}>
                  <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                </Pressable>
              )
            : undefined,
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <FlatList
          data={comments}
          keyExtractor={(comment) => comment.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.header}>
              <PostCard post={post} currentUid={user?.uid ?? ''} showStatus />
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
}: {
  comment: PostComment;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <Pressable
      onLongPress={canDelete ? onDelete : undefined}
      delayLongPress={400}
      style={styles.comment}>
      <Avatar uri={comment.author.photoURL} name={comment.author.username} size={32} />
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

const styles = StyleSheet.create({
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
});
