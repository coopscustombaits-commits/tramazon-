import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import {
  STARTER_BADGES,
  badgeMetricLabel,
  deleteBadge,
  fetchBadges,
  saveBadge,
  type BadgeDraft,
} from '@/lib/db/rewards';
import { slugify } from '@/lib/slug';
import type { Badge, BadgeMetric } from '@/types/models';

const METRICS: BadgeMetric[] = ['postCount', 'points', 'followerCount', 'fishLoggedCount'];

function emptyDraft(): BadgeDraft {
  return {
    id: '',
    title: '',
    description: '',
    icon: 'ribbon',
    metric: 'postCount',
    threshold: 10,
    order: 100,
    published: true,
  };
}

/**
 * Admin-only: badge definitions.
 *
 * Definitions are data, not code — the awarding function reads this collection
 * and awards anything whose threshold a profile has crossed, so adding "100
 * catches" is a document rather than a deploy.
 */
export default function AdminBadgesScreen() {
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();
  const { isAdmin, status } = useAuth();

  const [badges, setBadges] = useState<Badge[] | null>(null);
  const [editing, setEditing] = useState<BadgeDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'signed-in' && !isAdmin) router.replace('/(tabs)');
  }, [isAdmin, status, router]);

  const reload = useCallback(() => {
    if (!isAdmin) return;
    fetchBadges(true)
      .then(setBadges)
      .catch((error: unknown) => {
        console.warn('[admin/badges] load failed', error);
        setBadges([]);
      });
  }, [isAdmin]);

  useFocusEffect(reload);

  async function save(draft: BadgeDraft) {
    setSaving(true);
    try {
      await saveBadge(draft);
      setEditing(null);
      reload();
    } catch (error) {
      Alert.alert('Could not save', authErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(badge: Badge) {
    Alert.alert(
      `Delete “${badge.title}”?`,
      'Anglers who already earned it keep their copy — the definition is what goes away, so nobody new can earn it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteBadge(badge.id)
              .then(reload)
              .catch((error: unknown) =>
                Alert.alert('Could not delete', authErrorMessage(error)),
              );
          },
        },
      ],
    );
  }

  function seed() {
    Alert.alert(
      'Add the starter set?',
      `${STARTER_BADGES.length} badges covering catches, points, and followers. You can edit or delete any of them afterwards.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add them',
          onPress: () => {
            void Promise.all(STARTER_BADGES.map(saveBadge))
              .then(reload)
              .catch((error: unknown) =>
                Alert.alert('Could not add them', authErrorMessage(error)),
              );
          },
        },
      ],
    );
  }

  if (!isAdmin || !badges) return <ScreenLoader />;

  return (
    <Screen scroll>
      <Text style={styles.intro}>
        Badges are awarded automatically the moment an angler&apos;s number crosses the
        threshold. No deploy needed — this list is the definition.
      </Text>

      <View style={styles.actions}>
        <Button
          label="New badge"
          icon="add"
          variant="outline"
          onPress={() => setEditing(emptyDraft())}
          style={styles.action}
        />
        {badges.length === 0 ? (
          <Button
            label="Starter set"
            icon="sparkles-outline"
            variant="outline"
            onPress={seed}
            style={styles.action}
          />
        ) : null}
      </View>

      {badges.length === 0 ? (
        <EmptyState
          title="No badges yet"
          message="Add a few and anglers start earning them as soon as they qualify."
        />
      ) : (
        badges.map((badge) => (
          <Pressable
            key={badge.id}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${badge.title}`}
            onPress={() =>
              setEditing({
                id: badge.id,
                title: badge.title,
                description: badge.description,
                icon: badge.icon,
                metric: badge.metric,
                threshold: badge.threshold,
                order: badge.order,
                published: badge.published,
              })
            }
            onLongPress={() => confirmDelete(badge)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <View style={styles.medal}>
              <Ionicons
                name={(badge.icon as keyof typeof Ionicons.glyphMap) || 'ribbon'}
                size={20}
                color={Colors.accent}
              />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.title}>{badge.title}</Text>
              <Text style={styles.meta}>
                {badge.threshold} {badgeMetricLabel(badge.metric)}
                {badge.published ? '' : ' · draft'}
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
                  label="Name"
                  value={editing.title}
                  onChangeText={(value) => setEditing({ ...editing, title: value })}
                  placeholder="First Catch"
                  maxLength={60}
                  editable={!saving}
                />

                <TextField
                  label="Description"
                  value={editing.description}
                  onChangeText={(value) => setEditing({ ...editing, description: value })}
                  placeholder="Posted your first approved catch."
                  maxLength={200}
                  multiline
                  editable={!saving}
                />

                <TextField
                  label="Icon (Ionicons name)"
                  value={editing.icon}
                  onChangeText={(value) => setEditing({ ...editing, icon: value })}
                  placeholder="fish, trophy, star, ribbon"
                  autoCapitalize="none"
                  editable={!saving}
                />

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Earned on</Text>
                  <View style={styles.chips}>
                    {METRICS.map((metric) => {
                      const active = editing.metric === metric;
                      return (
                        <Pressable
                          key={metric}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          onPress={() => setEditing({ ...editing, metric })}
                          style={[styles.chip, active && styles.chipActive]}>
                          <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                            {badgeMetricLabel(metric)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <TextField
                  label="Threshold"
                  value={String(editing.threshold)}
                  onChangeText={(value) =>
                    setEditing({ ...editing, threshold: Number.parseInt(value, 10) || 0 })
                  }
                  keyboardType="number-pad"
                  editable={!saving}
                />

                <TextField
                  label="Sort order (lower shows first)"
                  value={String(editing.order)}
                  onChangeText={(value) =>
                    setEditing({ ...editing, order: Number.parseInt(value, 10) || 0 })
                  }
                  keyboardType="number-pad"
                  editable={!saving}
                />

                <View style={styles.publishRow}>
                  <Text style={styles.publishLabel}>Published</Text>
                  <Switch
                    value={editing.published}
                    onValueChange={(value) => setEditing({ ...editing, published: value })}
                    trackColor={{ true: Colors.primary, false: Colors.border }}
                    disabled={saving}
                  />
                </View>

                <Button
                  label="Save badge"
                  loading={saving}
                  disabled={!editing.title.trim()}
                  onPress={() => {
                    // A new badge gets its id from the name; an existing one
                    // keeps the id it was already awarded under, so renaming
                    // it doesn't orphan the awards already granted.
                    void save({
                      ...editing,
                      id: editing.id || slugify(editing.title) || '',
                    });
                  }}
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
  intro: { ...Typography.body, color: Colors.textMuted },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  action: { flex: 1 },
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
  medal: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
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
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryTint },
  chipLabel: { ...Typography.caption, color: Colors.text },
  chipLabelActive: { color: Colors.primary, fontWeight: '700' },
  publishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  publishLabel: { ...Typography.bodyStrong, color: Colors.text },
}));
