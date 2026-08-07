import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { EmptyState, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { getArticle } from '@/lib/db/articles';
import { shortTimeAgo } from '@/lib/format';
import { youtubeEmbedUrl, youtubeThumbnail, youtubeWatchUrl } from '@/lib/youtube';
import type { Article } from '@/types/models';

/** One tip or video. */
export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();

  const [article, setArticle] = useState<Article | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getArticle(id)
      .then((result) => {
        if (!cancelled) setArticle(result);
      })
      .catch((error: unknown) => {
        console.warn('[learn] could not load article', error);
        if (!cancelled) setArticle(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (article === undefined) return <ScreenLoader />;

  if (!article) {
    return (
      <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ title: 'Tip' }} />
        <EmptyState
          title="Not found"
          message="This may have been taken down."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: article.kind === 'video' ? 'Video' : 'Tip' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {article.youtubeId ? (
          <YouTubePlayer id={article.youtubeId} title={article.title} />
        ) : article.coverImageUrl ? (
          <Image
            source={{ uri: article.coverImageUrl }}
            style={styles.cover}
            contentFit="cover"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : null}

        <Text style={styles.title}>{article.title}</Text>
        <Text style={styles.byline}>
          {article.author.username} · {shortTimeAgo(article.publishedAt ?? article.createdAt)}
        </Text>

        {article.summary ? <Text style={styles.summary}>{article.summary}</Text> : null}

        {/* Paragraphs are blank-line separated. Rendering each as its own Text
            keeps the spacing right without pulling in a markdown renderer for
            what is, in practice, plain prose. */}
        {article.body
          .split(/\n{2,}/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
          .map((paragraph, index) => (
            <Text key={index} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}

        {article.tags.length > 0 ? (
          <View style={styles.tags}>
            {article.tags.map((tag) => (
              <Text key={tag} style={styles.tag}>
                #{tag}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * The video itself.
 *
 * On device this is a WebView pointed at the nocookie embed — inline playback,
 * no tracking until play, no YouTube SDK. On web the export renders through
 * react-dom, where `react-native-webview` has nothing to render, so that path
 * gets the thumbnail and a hand-off to YouTube instead.
 */
function YouTubePlayer({ id, title }: { id: string; title: string }) {
  const Colors = useThemeColors();
  const styles = useStyles();

  if (Platform.OS === 'web') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Watch ${title} on YouTube`}
        onPress={() => void WebBrowser.openBrowserAsync(youtubeWatchUrl(id))}
        style={styles.player}>
        <Image
          source={{ uri: youtubeThumbnail(id) }}
          style={styles.cover}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
        <View style={styles.playBadge}>
          <Ionicons name="play" size={24} color={Colors.textInverse} />
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.player}>
      <WebView
        source={{ uri: youtubeEmbedUrl(id) }}
        style={styles.webview}
        allowsFullscreenVideo
        // Tapping play should play, not open a modal player over the app.
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        javaScriptEnabled
        domStorageEnabled={false}
      />
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  player: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceMuted,
  },
  webview: { flex: 1, backgroundColor: Colors.surfaceMuted },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceMuted,
  },
  playBadge: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -28,
    marginTop: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.overlay,
  },
  title: { ...Typography.title, color: Colors.text },
  byline: { ...Typography.caption, color: Colors.textMuted },
  summary: { ...Typography.bodyStrong, color: Colors.textMuted },
  paragraph: { ...Typography.body, color: Colors.text, lineHeight: 24 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  tag: { ...Typography.caption, color: Colors.accent, fontWeight: '600' },
}));
