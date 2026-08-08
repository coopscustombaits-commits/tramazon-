import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Badge } from '@/components/ui/card';
import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { appealStatusLabel, fetchMyAppeals } from '@/lib/db/appeals';
import { shortTimeAgo } from '@/lib/format';
import type { Appeal } from '@/types/models';

/** Your own appeals and what came of them. */
export default function MyAppealsScreen() {
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();
  const { user } = useAuth();

  const [appeals, setAppeals] = useState<Appeal[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      fetchMyAppeals(user.uid)
        .then((result) => {
          if (!cancelled) setAppeals(result);
        })
        .catch((error: unknown) => {
          console.warn('[appeals] load failed', error);
          if (!cancelled) setAppeals([]);
        });
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  if (!appeals) return <ScreenLoader />;

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: 'Your Appeals' }} />
      <FlatList
        data={appeals}
        keyExtractor={(appeal) => appeal.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push(
                item.kind === 'post' ? `/post/${item.targetId}` : '/(tabs)/profile',
              )
            }
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
            <View style={styles.header}>
              <Badge
                label={appealStatusLabel(item.status)}
                tone={
                  item.status === 'granted'
                    ? 'approved'
                    : item.status === 'denied'
                      ? 'rejected'
                      : 'pending'
                }
              />
              <Text style={styles.time}>{shortTimeAgo(item.createdAt)}</Text>
            </View>

            <Text style={styles.what}>
              {item.kind === 'post' ? 'About a catch' : 'About your account'}
            </Text>
            <Text style={styles.message} numberOfLines={3}>
              {item.message}
            </Text>

            {item.decisionNote ? (
              <View style={styles.reply}>
                <Ionicons name="chatbubble-outline" size={14} color={Colors.primary} />
                <Text style={styles.replyText}>{item.decisionNote}</Text>
              </View>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No appeals"
            message="If one of your catches gets held back and you think that's wrong, you can appeal it from the catch itself."
          />
        }
      />
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: { padding: Spacing.lg, paddingBottom: Spacing.xxl, flexGrow: 1 },
  separator: { height: Spacing.md },
  card: {
    gap: Spacing.xs,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressed: { opacity: 0.85 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { ...Typography.caption, color: Colors.textFaint },
  what: { ...Typography.caption, color: Colors.textMuted, fontWeight: '600' },
  message: { ...Typography.body, color: Colors.text },
  reply: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryTint,
  },
  replyText: { ...Typography.caption, color: Colors.primary, flex: 1 },
}));
