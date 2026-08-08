import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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

import { ReportSheet } from '@/components/report-sheet';
import { EmptyState, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { useRemoteConfig } from '@/lib/db/config-context';
import {
  MESSAGE_MAX,
  deleteMessage,
  otherParticipant,
  markConversationRead,
  sendMessage,
  subscribeToConversation,
  subscribeToMessages,
} from '@/lib/db/messages';
import { shortTimeAgo } from '@/lib/format';
import type { Conversation, DirectMessage } from '@/types/models';

/** One conversation. */
export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();
  const { user } = useAuth();
  const config = useRemoteConfig();
  const listRef = useRef<FlatList<DirectMessage>>(null);

  const [conversation, setConversation] = useState<Conversation | null | undefined>(
    undefined,
  );
  const [messages, setMessages] = useState<DirectMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState<DirectMessage | null>(null);

  useEffect(() => {
    if (!id) return;
    return subscribeToConversation(id, setConversation, (error) => {
      console.warn('[thread] failed to load', error);
      setConversation(null);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeToMessages(id, setMessages, (error) => {
      console.warn('[thread] failed to load messages', error);
      setMessages([]);
    });
  }, [id]);

  const other = conversation && user ? otherParticipant(conversation, user.uid) : null;
  const unread = conversation?.unread?.[user?.uid ?? ''] ?? 0;

  // Opening the thread is what marks it read. Guarded on the count so this
  // doesn't write on every snapshot.
  useEffect(() => {
    if (!id || !user || unread === 0) return;
    void markConversationRead(id, user.uid).catch((error: unknown) =>
      console.warn('[thread] could not mark read', error),
    );
  }, [id, user, unread]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || !id || !user || sending) return;
    setSending(true);
    // Clear optimistically — the message appears from the live subscription,
    // and leaving the text sitting there reads as "it didn't send".
    setDraft('');
    try {
      await sendMessage(id, user.uid, text);
      listRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      setDraft(text);
      Alert.alert('Not sent', authErrorMessage(error));
    } finally {
      setSending(false);
    }
  }, [draft, id, user, sending]);

  const onLongPress = useCallback(
    (message: DirectMessage) => {
      const mine = message.senderId === user?.uid;
      Alert.alert(
        'Message',
        undefined,
        [
          mine
            ? {
                text: 'Delete',
                style: 'destructive' as const,
                onPress: () => {
                  if (id) {
                    void deleteMessage(id, message.id).catch((error: unknown) =>
                      Alert.alert('Could not delete', authErrorMessage(error)),
                    );
                  }
                },
              }
            : { text: 'Report', onPress: () => setReporting(message) },
          { text: 'Cancel', style: 'cancel' as const },
        ],
        { cancelable: true },
      );
    },
    [id, user],
  );

  if (conversation === undefined || messages === null) return <ScreenLoader />;

  if (conversation === null) {
    return (
      <EmptyState
        title="Conversation not found"
        message="It may have been removed."
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}>
      <Stack.Screen
        options={{
          title: other?.username ?? 'Message',
          headerRight: () =>
            other ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${other.username}'s profile`}
                hitSlop={8}
                onPress={() => router.push(`/user/${other.uid}`)}>
                <Ionicons name="person-circle-outline" size={24} color={Colors.text} />
              </Pressable>
            ) : null,
        }}
      />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(message) => message.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.senderId === user?.uid;
          const removed = item.removedAt != null;
          return (
            <Pressable
              onLongPress={() => !removed && onLongPress(item)}
              delayLongPress={300}
              style={[styles.bubbleRow, mine ? styles.bubbleRowMine : null]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text
                  style={[
                    mine ? styles.textMine : styles.textTheirs,
                    removed && styles.removed,
                  ]}>
                  {removed ? 'This message was removed.' : item.text}
                </Text>
                <Text style={mine ? styles.metaMine : styles.metaTheirs}>
                  {shortTimeAgo(item.createdAt)}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title={`Say hi to ${other?.username ?? 'them'}`}
            message="Talk baits, spots, or what they're rigging. Be decent — messages can be reported."
          />
        }
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={config.messagingEnabled ? 'Message' : 'Messaging is paused'}
          placeholderTextColor={Colors.textFaint}
          editable={config.messagingEnabled}
          multiline
          maxLength={MESSAGE_MAX}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          disabled={!draft.trim() || sending || !config.messagingEnabled}
          onPress={() => void send()}
          style={[
            styles.send,
            (!draft.trim() || sending || !config.messagingEnabled) && styles.sendDisabled,
          ]}>
          <Ionicons name="arrow-up" size={20} color={Colors.textInverse} />
        </Pressable>
      </View>

      {reporting ? (
        <ReportSheet
          visible
          onClose={() => setReporting(null)}
          targetType="message"
          targetId={reporting.id}
          parentId={id}
          targetOwnerId={reporting.senderId}
          targetLabel="this message"
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.lg, gap: Spacing.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    gap: 2,
  },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: Radius.sm },
  bubbleTheirs: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: Radius.sm,
  },
  textMine: { ...Typography.body, color: Colors.textInverse },
  textTheirs: { ...Typography.body, color: Colors.text },
  removed: { fontStyle: 'italic', opacity: 0.7 },
  metaMine: { ...Typography.caption, color: Colors.textInverse, opacity: 0.75 },
  metaTheirs: { ...Typography.caption, color: Colors.textFaint },
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
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  sendDisabled: { opacity: 0.4 },
}));
