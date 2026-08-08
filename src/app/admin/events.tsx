import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { hasPassed, whenLabel } from '@/lib/calendar';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import {
  EVENT_TEXT_MAX,
  EVENT_TITLE_MAX,
  createEvent,
  deleteEvent,
  draftFromEvent,
  emptyEventDraft,
  subscribeToAllEvents,
  updateEvent,
  type EventDraft,
} from '@/lib/db/events';
import type { CalendarEvent } from '@/types/models';

/** How far ahead the quick date buttons offer, in days. */
const OFFSETS = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'Next week', days: 7 },
  { label: 'In a month', days: 30 },
];

/**
 * Admin-only: the calendar.
 *
 * Dates are picked with "today / tomorrow / next week / in a month" buttons
 * rather than a native date picker — the same trade as the competition editor.
 * A picker is an extra native module for something done a few times a month,
 * and these cover what actually gets scheduled.
 */
export default function AdminEventsScreen() {
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();
  const { isAdmin, status, user } = useAuth();

  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; draft: EventDraft } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'signed-in' && !isAdmin) router.replace('/(tabs)');
  }, [isAdmin, status, router]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeToAllEvents(setEvents, (error) => {
      console.warn('[admin/events] load failed', error);
      setEvents([]);
    });
  }, [isAdmin]);

  async function save() {
    if (!editing || !user) return;
    setSaving(true);
    try {
      if (editing.id) {
        await updateEvent(editing.id, editing.draft);
      } else {
        await createEvent(user.uid, editing.draft);
      }
      setEditing(null);
    } catch (error) {
      Alert.alert('Could not save', authErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(event: CalendarEvent) {
    Alert.alert(`Delete “${event.title}”?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteEvent(event.id).catch((error: unknown) =>
            Alert.alert('Could not delete', authErrorMessage(error)),
          );
        },
      },
    ]);
  }

  function setField<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setEditing((current) =>
      current ? { ...current, draft: { ...current.draft, [key]: value } } : current,
    );
  }

  function startOn(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(9, 0, 0, 0);
    setField('startsAt', date);
  }

  if (!isAdmin || !events) return <ScreenLoader />;

  return (
    <Screen scroll>
      <Button
        label="Add an event"
        icon="add"
        variant="outline"
        onPress={() => setEditing({ id: null, draft: emptyEventDraft() })}
      />

      {events.length === 0 ? (
        <EmptyState
          title="Nothing scheduled"
          message="Tournament dates, restocks, meet-ups — anything with a date on it."
        />
      ) : (
        events.map((event) => (
          <Pressable
            key={event.id}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${event.title}`}
            onPress={() => setEditing({ id: event.id, draft: draftFromEvent(event) })}
            onLongPress={() => confirmDelete(event)}
            style={({ pressed }) => [
              styles.row,
              hasPassed(event) && styles.rowPast,
              pressed && styles.rowPressed,
            ]}>
            <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
            <View style={styles.rowBody}>
              <Text style={styles.title} numberOfLines={1}>
                {event.title || 'Untitled'}
              </Text>
              <Text style={styles.meta}>
                {whenLabel(event)}
                {event.published ? '' : ' · draft'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textFaint} />
          </Pressable>
        ))
      )}

      <Modal
        visible={editing !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditing(null)}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => setEditing(null)}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {editing ? (
              <>
                <TextField
                  label="Title"
                  value={editing.draft.title}
                  onChangeText={(value) => setField('title', value)}
                  placeholder="Fall Bass Classic weigh-in"
                  maxLength={EVENT_TITLE_MAX}
                  editable={!saving}
                />

                <TextField
                  label="Where"
                  value={editing.draft.location}
                  onChangeText={(value) => setField('location', value)}
                  placeholder="Lake Fork boat ramp"
                  maxLength={200}
                  editable={!saving}
                />

                <TextField
                  label="Details"
                  value={editing.draft.description}
                  onChangeText={(value) => setField('description', value)}
                  placeholder="What's happening, what to bring"
                  multiline
                  maxLength={EVENT_TEXT_MAX}
                  style={styles.description}
                  editable={!saving}
                />

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>When</Text>
                  <View style={styles.chips}>
                    {OFFSETS.map((offset) => (
                      <Pressable
                        key={offset.label}
                        accessibilityRole="button"
                        disabled={saving}
                        onPress={() => startOn(offset.days)}
                        style={styles.chip}>
                        <Text style={styles.chipLabel}>{offset.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.hint}>
                    {editing.draft.startsAt
                      ? editing.draft.startsAt.toLocaleString()
                      : 'Pick a date — an event needs one.'}
                  </Text>
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>All day</Text>
                  <Switch
                    value={editing.draft.allDay}
                    onValueChange={(value) => setField('allDay', value)}
                    trackColor={{ true: Colors.primary, false: Colors.border }}
                    disabled={saving}
                  />
                </View>

                <TextField
                  label="Link (optional)"
                  value={editing.draft.href}
                  onChangeText={(value) => setField('href', value)}
                  placeholder="/compete/abc123?kind=tournament"
                  autoCapitalize="none"
                  editable={!saving}
                />

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Published</Text>
                  <Switch
                    value={editing.draft.published}
                    onValueChange={(value) => setField('published', value)}
                    trackColor={{ true: Colors.primary, false: Colors.border }}
                    disabled={saving}
                  />
                </View>

                <Button
                  label={editing.id ? 'Save' : 'Add to calendar'}
                  loading={saving}
                  disabled={!editing.draft.title.trim() || !editing.draft.startsAt}
                  onPress={() => void save()}
                />
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={() => setEditing(null)}
                  disabled={saving}
                />
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
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
  rowPast: { opacity: 0.55 },
  rowPressed: { opacity: 0.85 },
  rowBody: { flex: 1, gap: 2 },
  title: { ...Typography.bodyStrong, color: Colors.text },
  meta: { ...Typography.caption, color: Colors.textMuted },
  backdrop: { flex: 1, backgroundColor: Colors.overlay },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '90%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginTop: Spacing.sm,
  },
  sheetBody: { padding: Spacing.lg, gap: Spacing.md },
  description: { minHeight: 90, textAlignVertical: 'top' },
  field: { gap: Spacing.sm },
  fieldLabel: { ...Typography.caption, color: Colors.textMuted, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipLabel: { ...Typography.caption, color: Colors.text },
  hint: { ...Typography.caption, color: Colors.textMuted },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  switchLabel: { ...Typography.bodyStrong, color: Colors.text },
}));
