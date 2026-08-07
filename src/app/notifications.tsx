import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ScreenLoader } from '@/components/ui/screen';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/lib/auth/auth-context';
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  unreadCount,
} from '@/lib/db/notifications';
import { shortTimeAgo } from '@/lib/format';
import type { AppNotification, NotificationType } from '@/types/models';

/** Icon and tint per notification kind. Unknown types fall back to a bell. */
const APPEARANCE: Record<
  NotificationType,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  post_approved: { icon: 'checkmark-circle', color: Colors.success },
  post_rejected: { icon: 'close-circle', color: Colors.danger },
  post_needs_review: { icon: 'shield-checkmark', color: Colors.accent },
  post_liked: { icon: 'heart', color: Colors.danger },
  post_commented: { icon: 'chatbubble', color: Colors.link },
  new_follower: { icon: 'person-add', color: Colors.primary },
  new_message: { icon: 'mail', color: Colors.link },
  badge_earned: { icon: 'ribbon', color: Colors.accent },
  announcement: { icon: 'megaphone', color: Colors.primary },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(
      user.uid,
      (next) => {
        setNotifications(next);
        setLoaded(true);
      },
      (error) => {
        console.warn('[notifications] subscription failed', error);
        setLoaded(true);
      },
    );
  }, [user]);

  async function open(notification: AppNotification) {
    if (!user) return;
    if (notification.readAt === null) {
      // Fire and forget — a failed read receipt shouldn't block navigation.
      void markNotificationRead(user.uid, notification.id).catch(() => undefined);
    }
    if (notification.href) {
      router.push(notification.href as never);
    }
  }

  if (!loaded) return <ScreenLoader />;

  const unread = unreadCount(notifications);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Activity',
          headerRight:
            unread > 0
              ? () => (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => user && void markAllNotificationsRead(user.uid)}>
                    <Text style={styles.markAll}>Mark all read</Text>
                  </Pressable>
                )
              : undefined,
        }}
      />

      <FlatList
        data={notifications}
        keyExtractor={(notification) => notification.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <NotificationRow notification={item} onPress={() => void open(item)} />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Nothing yet"
            message="Approvals, likes, and comments on your catches will show up here."
          />
        }
      />
    </SafeAreaView>
  );
}

function NotificationRow({
  notification,
  onPress,
}: {
  notification: AppNotification;
  onPress: () => void;
}) {
  const appearance = APPEARANCE[notification.type] ?? {
    icon: 'notifications' as const,
    color: Colors.primary,
  };
  const unread = notification.readAt === null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        unread && styles.rowUnread,
        pressed && styles.rowPressed,
      ]}>
      <View style={[styles.iconCircle, { backgroundColor: `${appearance.color}1A` }]}>
        <Ionicons name={appearance.icon} size={18} color={appearance.color} />
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{notification.title}</Text>
        <Text style={styles.rowMessage}>{notification.body}</Text>
        <Text style={styles.rowTime}>{shortTimeAgo(notification.createdAt)}</Text>
      </View>

      {unread ? <View style={styles.unreadDot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    padding: Spacing.lg,
    flexGrow: 1,
  },
  separator: {
    height: Spacing.sm,
  },
  markAll: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowUnread: {
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.primaryTint,
  },
  rowPressed: {
    opacity: 0.85,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...Typography.bodyStrong,
  },
  rowMessage: {
    ...Typography.body,
    color: Colors.textMuted,
  },
  rowTime: {
    ...Typography.caption,
    color: Colors.textFaint,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    marginTop: Spacing.sm,
  },
});
