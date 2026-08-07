import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { fetchPublishedArticles } from '@/lib/db/articles';
import { shortTimeAgo } from '@/lib/format';
import { youtubeThumbnail } from '@/lib/youtube';
import type { Article } from '@/types/models';

/**
 * Tips & Videos — Coop's how-tos and his YouTube uploads in one list.
 *
 * Articles and videos share a collection because they're the same thing to a
 * reader: something Coop published. Two collections would mean two queries and
 * a merge just to render one list in date order.
 */
export default function LearnScreen() {
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();

  const [articles, setArticles] = useState<Article[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchPublishedArticles()
        .then((result) => {
          if (!cancelled) {
            setArticles(result);
            setError(null);
          }
        })
        .catch((caught: unknown) => {
          console.warn('[learn] load failed', caught);
          if (!cancelled) {
            setError('Could not load tips right now.');
            setArticles([]);
          }
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (!articles) return <ScreenLoader />;

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: 'Tips & Videos' }} />
      <FlatList
        data={articles}
        keyExtractor={(article) => article.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const cover =
            item.coverImageUrl ??
            (item.youtubeId ? youtubeThumbnail(item.youtubeId) : null);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/learn/${item.id}`)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              {cover ? (
                <View>
                  <Image
                    source={{ uri: cover }}
                    style={styles.cover}
                    contentFit="cover"
                    transition={150}
                    accessibilityIgnoresInvertColors
                  />
                  {item.kind === 'video' ? (
                    <View style={styles.playBadge}>
                      <Ionicons name="play" size={20} color={Colors.textInverse} />
                    </View>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.cardBody}>
                <View style={styles.kindRow}>
                  <Ionicons
                    name={item.kind === 'video' ? 'logo-youtube' : 'book-outline'}
                    size={14}
                    color={Colors.accent}
                  />
                  <Text style={styles.kind}>
                    {item.kind === 'video' ? 'Video' : 'Tip'}
                  </Text>
                  <Text style={styles.time}>{shortTimeAgo(item.publishedAt)}</Text>
                </View>
                <Text style={styles.title}>{item.title}</Text>
                {item.summary ? (
                  <Text style={styles.summary} numberOfLines={2}>
                    {item.summary}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title={error ? 'Something went wrong' : 'Nothing here yet'}
            message={error ?? 'Coop hasn’t posted any tips or videos yet. Check back.'}
          />
        }
      />
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: { padding: Spacing.lg, paddingBottom: Spacing.xxl, flexGrow: 1 },
  separator: { height: Spacing.lg },
  card: {
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressed: { opacity: 0.9 },
  cover: { width: '100%', aspectRatio: 16 / 9, backgroundColor: Colors.surfaceMuted },
  playBadge: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -24,
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.overlay,
  },
  cardBody: { padding: Spacing.md, gap: Spacing.xs },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  kind: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  time: { ...Typography.caption, color: Colors.textFaint, marginLeft: 'auto' },
  title: { ...Typography.bodyStrong, color: Colors.text },
  summary: { ...Typography.caption, color: Colors.textMuted },
}));
