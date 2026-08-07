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
  ARTICLE_BODY_MAX,
  ARTICLE_SUMMARY_MAX,
  ARTICLE_TITLE_MAX,
  createArticle,
  draftFrom,
  emptyDraft,
  getArticle,
  updateArticle,
  type ArticleDraft,
} from '@/lib/db/articles';
import { youtubeId } from '@/lib/youtube';
import type { Article, ArticleKind } from '@/types/models';

/**
 * Admin-only: write a tip or add a YouTube video.
 *
 * One screen for create and edit — with `?id=` it loads the existing article,
 * without it you get a blank draft. Two screens would be the same form twice.
 */
export default function ArticleEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();
  const { isAdmin, status, profile } = useAuth();

  const [existing, setExisting] = useState<Article | null>(null);
  const [draft, setDraft] = useState<ArticleDraft>(emptyDraft);
  const [tagText, setTagText] = useState('');
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'signed-in' && !isAdmin) router.replace('/(tabs)');
  }, [isAdmin, status, router]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getArticle(id)
      .then((article) => {
        if (cancelled || !article) return;
        setExisting(article);
        setDraft(draftFrom(article));
        setTagText(article.tags.join(', '));
      })
      .catch((error: unknown) => console.warn('[admin/article] load failed', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function set<K extends keyof ArticleDraft>(key: K, value: ArticleDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      const withTags: ArticleDraft = {
        ...draft,
        tags: tagText.split(',').map((tag) => tag.trim()).filter(Boolean),
      };
      if (existing) {
        await updateArticle(existing.id, withTags, existing);
      } else {
        await createArticle(profile, withTags);
      }
      router.back();
    } catch (error) {
      Alert.alert('Could not save', authErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin || loading) return <ScreenLoader />;

  // Shown live so a bad paste is obvious before saving rather than after.
  const videoId = draft.kind === 'video' ? youtubeId(draft.youtubeUrl) : null;
  const videoProblem =
    draft.kind === 'video' && draft.youtubeUrl.trim().length > 0 && !videoId;

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: existing ? 'Edit' : 'New' }} />

      <View style={styles.kinds}>
        {(['article', 'video'] as ArticleKind[]).map((kind) => (
          <Pressable
            key={kind}
            accessibilityRole="radio"
            accessibilityState={{ selected: draft.kind === kind }}
            onPress={() => set('kind', kind)}
            style={[styles.kind, draft.kind === kind && styles.kindActive]}>
            <Text style={[styles.kindLabel, draft.kind === kind && styles.kindLabelActive]}>
              {kind === 'article' ? 'Written tip' : 'YouTube video'}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextField
        label="Title"
        value={draft.title}
        onChangeText={(value) => set('title', value)}
        placeholder="Winter jigging for smallmouth"
        maxLength={ARTICLE_TITLE_MAX}
        editable={!saving}
      />

      <TextField
        label="Summary"
        value={draft.summary}
        onChangeText={(value) => set('summary', value)}
        placeholder="One or two lines — this is what shows in the list"
        multiline
        maxLength={ARTICLE_SUMMARY_MAX}
        editable={!saving}
      />

      {draft.kind === 'video' ? (
        <>
          <TextField
            label="YouTube link"
            value={draft.youtubeUrl}
            onChangeText={(value) => set('youtubeUrl', value)}
            placeholder="Paste the link or the video id"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
            error={videoProblem ? "That doesn't look like a YouTube link." : undefined}
          />
          {videoId ? (
            <Text style={styles.hint}>Video id: {videoId}</Text>
          ) : null}
        </>
      ) : (
        <TextField
          label="The tip"
          value={draft.body}
          onChangeText={(value) => set('body', value)}
          placeholder={'Write it out.\n\nLeave a blank line between paragraphs.'}
          multiline
          maxLength={ARTICLE_BODY_MAX}
          style={styles.body}
          editable={!saving}
        />
      )}

      <TextField
        label="Tags"
        value={tagText}
        onChangeText={setTagText}
        placeholder="bass, winter, jigging"
        autoCapitalize="none"
        editable={!saving}
      />

      <View style={styles.publishRow}>
        <View style={styles.publishText}>
          <Text style={styles.publishLabel}>Published</Text>
          <Text style={styles.publishHint}>
            {draft.published
              ? 'Visible to everyone in Tips & Videos.'
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
        label={existing ? 'Save' : 'Create'}
        onPress={() => void save()}
        loading={saving}
        disabled={!draft.title.trim() || videoProblem}
      />
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  kinds: { flexDirection: 'row', gap: Spacing.sm },
  kind: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  kindActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryTint },
  kindLabel: { ...Typography.caption, color: Colors.text },
  kindLabelActive: { color: Colors.primary, fontWeight: '700' },
  body: { minHeight: 220, textAlignVertical: 'top' },
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
