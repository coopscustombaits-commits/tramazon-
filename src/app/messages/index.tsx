import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { useBlocked } from '@/lib/db/blocked-context';
import { otherParticipant, subscribeToConversations } from '@/lib/db/messages';
import { shortTimeAgo } from '@/lib/format';
import type { Conversation } from '@/types/models';

/** The message inbox. */
export default function MessagesScreen() {
  const router = useRouter();
  const styles = useStyles();
  const { user } = useAuth();
  const { blockedIds } = useBlocked();

  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToConversations(
      user.uid,
      (next) => {
        setConversations(next);
        setError(null);
      },
      (caught) => {
        console.warn('[messages] failed to load', caught);
        setError('Could not load your messages.');
        setConversations([]);
      },
    );
  }, [user]);

  if (!conversations) return <ScreenLoader />;

  // A blocked person's thread disappears from your inbox. The rules already
  // stop them sending; this is what stops the old thread sitting there.
  const visible = conversations.filter((thread) => {
    const other = otherParticipant(thread, user?.uid ?? '');
    return other ? !blockedIds.has(other.uid) : false;
  });

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: 'Messages' }} />
      <FlatList
        data={visible}
        keyExtractor={(thread) => thread.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const other = otherParticipant(item, user?.uid ?? '');
          const unread = item.unread?.[user?.uid ?? ''] ?? 0;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                unread > 0
                  ? `Conversation with ${other?.username ?? 'an angler'}, ${unread} unread`
                  : `Conversation with ${other?.username ?? 'an angler'}`
              }
              onPress={() => router.push(`/messages/${item.id}`)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <Avatar uri={other?.photoURL} name={other?.username} size={48} />
              <View style={styles.body}>
                <View style={styles.topLine}>
                  <Text style={styles.name} numberOfLines={1}>
                    {other?.username ?? 'Angler'}
                  </Text>
                  <Text style={styles.time}>{shortTimeAgo(item.lastMessageAt)}</Text>
                </View>
                <Text
                  style={[styles.preview, unread > 0 && styles.previewUnread]}
                  numberOfLines={1}>
                  {item.lastMessage
                    ? `${item.lastMessage.senderId === user?.uid ? 'You: ' : ''}${item.lastMessage.text}`
                    : 'No messages yet'}
                </Text>
              </View>
              {unread > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title={error ? 'Something went wrong' : 'No messages yet'}
            message={
              error ??
              'Open an angler’s profile and tap Message to start a conversation.'
            }
          />
        }
      />
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: { padding: Spacing.lg, paddingBottom: Spacing.xxl, flexGrow: 1 },
  separator: { height: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowPressed: { opacity: 0.85 },
  body: { flex: 1, gap: 2 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { ...Typography.bodyStrong, color: Colors.text, flex: 1 },
  time: { ...Typography.caption, color: Colors.textFaint },
  preview: { ...Typography.caption, color: Colors.textMuted },
  previewUnread: { color: Colors.text, fontWeight: '600' },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...Typography.caption, color: Colors.textInverse, fontWeight: '700' },
}));
