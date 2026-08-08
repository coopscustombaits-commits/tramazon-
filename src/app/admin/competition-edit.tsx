import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen, ScreenLoader } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import {
  COMPETITION_TEXT_MAX,
  COMPETITION_TITLE_MAX,
  createCompetition,
  draftFromCompetition,
  emptyCompetitionDraft,
  getCompetition,
  updateCompetition,
  type CompetitionDraft,
} from '@/lib/db/competitions';
import { speciesSlug } from '@/lib/species';
import type { CompetitionKind, CompetitionScoring } from '@/types/models';

/** How many days out the quick date buttons offer. */
const DURATIONS = [7, 14, 30];

/**
 * Admin-only: start a challenge or a tournament.
 *
 * One screen for create and edit; `?kind=` says which collection and `?id=`
 * (when present) says which document.
 */
export default function CompetitionEditScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: CompetitionKind; id?: string }>();
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();
  const { isAdmin, status, user } = useAuth();

  const [draft, setDraft] = useState<CompetitionDraft>(emptyCompetitionDraft);
  const [speciesText, setSpeciesText] = useState('');
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'signed-in' && !isAdmin) router.replace('/(tabs)');
  }, [isAdmin, status, router]);

  useEffect(() => {
    if (!id || !kind) return;
    let cancelled = false;
    getCompetition(kind, id)
      .then((competition) => {
        if (cancelled || !competition) return;
        setDraft(draftFromCompetition(competition));
        setSpeciesText(competition.speciesSlug?.replace(/-/g, ' ') ?? '');
      })
      .catch((error: unknown) => console.warn('[admin/competition] load failed', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, kind]);

  function set<K extends keyof CompetitionDraft>(key: K, value: CompetitionDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  /**
   * Quick "runs for N days" buttons instead of a date picker.
   *
   * A native date picker is a whole extra native module for something Coop
   * does a handful of times a year, and "starts now, runs a fortnight" is what
   * he actually wants nine times out of ten.
   */
  function runFor(days: number) {
    const start = draft.startsAt ?? new Date();
    const end = new Date(start.getTime() + days * 86_400_000);
    setDraft((current) => ({ ...current, startsAt: start, endsAt: end }));
  }

  async function save() {
    if (!user || !kind) return;
    setSaving(true);
    try {
      const withSpecies: CompetitionDraft = {
        ...draft,
        speciesSlug: speciesSlug(speciesText),
      };
      if (id) {
        await updateCompetition(kind, id, withSpecies);
      } else {
        await createCompetition(kind, user.uid, withSpecies);
      }
      router.back();
    } catch (error) {
      Alert.alert('Could not save', authErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin || loading || !kind) return <ScreenLoader />;

  const noun = kind === 'tournament' ? 'tournament' : 'challenge';

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: id ? `Edit ${noun}` : `New ${noun}` }} />

      <TextField
        label="Title"
        value={draft.title}
        onChangeText={(value) => set('title', value)}
        placeholder={
          kind === 'tournament' ? 'Fall Bass Classic' : 'Topwater week'
        }
        maxLength={COMPETITION_TITLE_MAX}
        editable={!saving}
      />

      <TextField
        label="What to do to enter"
        value={draft.description}
        onChangeText={(value) => set('description', value)}
        placeholder="Post a catch you took on a topwater bait between Monday and Sunday."
        multiline
        maxLength={COMPETITION_TEXT_MAX}
        style={styles.description}
        editable={!saving}
      />

      <TextField
        label="Prize"
        value={draft.prize}
        onChangeText={(value) => set('prize', value)}
        placeholder="A pack of Deep Divers"
        maxLength={200}
        editable={!saving}
      />

      <TextField
        label="Species only (optional)"
        value={speciesText}
        onChangeText={setSpeciesText}
        placeholder="Largemouth bass — leave blank for anything"
        autoCapitalize="words"
        editable={!saving}
      />

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Scored by</Text>
        <View style={styles.chips}>
          {(
            [
              ['most_likes', 'Most likes'],
              ['admin_pick', 'You pick'],
            ] as [CompetitionScoring, string][]
          ).map(([value, label]) => {
            const active = draft.scoring === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                disabled={saving}
                onPress={() => set('scoring', value)}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>
          {draft.scoring === 'admin_pick'
            ? 'Your featured entries go to the top of the leaderboard, then the most-liked underneath.'
            : 'The leaderboard is ordered by likes. Like counts are server-written, so they can’t be gamed from a modified app.'}
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>How long it runs</Text>
        <View style={styles.chips}>
          {DURATIONS.map((days) => (
            <Pressable
              key={days}
              accessibilityRole="button"
              disabled={saving}
              onPress={() => runFor(days)}
              style={styles.chip}>
              <Text style={styles.chipLabel}>{days} days</Text>
            </Pressable>
          ))}
          {draft.endsAt ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear the dates"
              disabled={saving}
              onPress={() => setDraft((current) => ({ ...current, startsAt: null, endsAt: null }))}
              style={styles.chip}>
              <Text style={styles.chipLabel}>No end</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.hint}>
          {draft.startsAt && draft.endsAt
            ? `${draft.startsAt.toLocaleDateString()} — ${draft.endsAt.toLocaleDateString()}`
            : 'Open-ended: it accepts entries until you unpublish it.'}
        </Text>
      </View>

      <View style={styles.publishRow}>
        <View style={styles.publishText}>
          <Text style={styles.publishLabel}>Published</Text>
          <Text style={styles.publishHint}>
            {draft.published
              ? 'Anglers can see it and enter.'
              : 'Only you can see this. Turn it on when it’s ready.'}
          </Text>
        </View>
        <Switch
          value={draft.published}
          onValueChange={(value) => set('published', value)}
          trackColor={{ true: Colors.primary, false: Colors.border }}
          disabled={saving}
        />
      </View>

      <Button
        label={id ? 'Save' : `Create ${noun}`}
        onPress={() => void save()}
        loading={saving}
        disabled={!draft.title.trim()}
      />
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  description: { minHeight: 120, textAlignVertical: 'top' },
  field: { gap: Spacing.sm },
  fieldLabel: { ...Typography.caption, color: Colors.textMuted, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryTint },
  chipLabel: { ...Typography.caption, color: Colors.text },
  chipLabelActive: { color: Colors.primary, fontWeight: '700' },
  hint: { ...Typography.caption, color: Colors.textMuted },
  publishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  publishText: { flex: 1, gap: 2 },
  publishLabel: { ...Typography.bodyStrong, color: Colors.text },
  publishHint: { ...Typography.caption, color: Colors.textMuted },
}));
