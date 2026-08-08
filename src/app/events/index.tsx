import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';

import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { groupByMonth, whenLabel } from '@/lib/calendar';
import { fetchEvents } from '@/lib/db/events';
import type { CalendarEvent } from '@/types/models';

/**
 * What's coming up — tournament dates, shop drops, meet-ups.
 *
 * Only future events, because a calendar that opens on last March is a list
 * you have to scroll past rather than one you read.
 */
export default function EventsScreen() {
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();

  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // From the start of today, not from now — an event at 9am is still
      // "today's" at 2pm, and dropping it mid-afternoon reads as a bug.
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      fetchEvents(startOfToday)
        .then((result) => {
          if (cancelled) return;
          setEvents(result);
          setError(null);
        })
        .catch((caught: unknown) => {
          console.warn('[events] load failed', caught);
          if (!cancelled) {
            setError('Could not load the calendar.');
            setEvents([]);
          }
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (!events) return <ScreenLoader />;

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: 'Calendar' }} />
      <SectionList
        sections={groupByMonth(events)}
        keyExtractor={(event) => event.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.month}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole={item.href ? 'button' : undefined}
            disabled={!item.href}
            onPress={() => item.href && router.push(item.href as never)}
            style={({ pressed }) => [styles.card, pressed && item.href && styles.cardPressed]}>
            <View style={styles.cardHeader}>
              <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
              <Text style={styles.when}>{whenLabel(item)}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            {item.location ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.location}>{item.location}</Text>
              </View>
            ) : null}
            {item.description ? (
              <Text style={styles.description}>{item.description}</Text>
            ) : null}
            {item.href ? (
              <Text style={styles.link}>Open →</Text>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            title={error ? 'Something went wrong' : 'Nothing on the calendar'}
            message={
              error ?? 'No dates coming up yet. Coop adds tournaments and drops here.'
            }
          />
        }
      />
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: { padding: Spacing.lg, paddingBottom: Spacing.xxl, flexGrow: 1, gap: Spacing.md },
  month: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
  },
  card: {
    gap: Spacing.xs,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressed: { opacity: 0.85 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  when: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
  title: { ...Typography.bodyStrong, color: Colors.text },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  location: { ...Typography.caption, color: Colors.textMuted },
  description: { ...Typography.body, color: Colors.textMuted },
  link: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },
}));
