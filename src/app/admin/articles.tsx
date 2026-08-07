import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { authErrorMessage } from '@/lib/auth/errors';
import { deleteArticle, subscribeToAllArticles } from '@/lib/db/articles';
import { shortTimeAgo } from '@/lib/format';
import type { Article } from '@/types/models';

/** Admin-only: everything published or drafted, and the way in to the editor. */
export default function AdminArticlesScreen() {
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();
  const { isAdmin, status } = useAuth();

  const [articles, setArticles] = useState<Article[] | null>(null);

  useEffect(() => {
    if (status === 'signed-in' && !isAdmin) router.replace('/(tabs)');
  }, [isAdmin, status, router]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeToAllArticles(setArticles, (error) => {
      console.warn('[admin/articles] load failed', error);
      setArticles([]);
    });
  }, [isAdmin]);

  function confirmDelete(article: Article) {
    Alert.alert(`Delete “${article.title}”?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteArticle(article).catch((error: unknown) =>
            Alert.alert('Could not delete', authErrorMessage(error)),
          );
        },
      },
    ]);
  }

  if (!isAdmin || !articles) return <ScreenLoader />;

  return (
    <Screen padded={false}>
      <FlatList
        data={articles}
        keyExtractor={(article) => article.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <Button
            label="Write something new"
            icon="add"
            onPress={() => router.push('/admin/article-edit')}
            style={styles.newButton}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.title}`}
            onPress={() =>
              router.push({ pathname: '/admin/article-edit', params: { id: item.id } })
            }
            onLongPress={() => confirmDelete(item)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <Ionicons
              name={item.kind === 'video' ? 'logo-youtube' : 'book-outline'}
              size={20}
              color={Colors.primary}
            />
            <View style={styles.rowBody}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title || 'Untitled'}
              </Text>
              <Text style={styles.meta}>
                {item.published ? 'Published' : 'Draft'} ·{' '}
                {shortTimeAgo(item.updatedAt)}
              </Text>
            </View>
            {item.published ? null : <View style={styles.draftDot} />}
            <Ionicons name="chevron-forward" size={18} color={Colors.textFaint} />
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Nothing written yet"
            message="Tips and videos you publish show up in the app under Tips & Videos."
          />
        }
      />
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: { padding: Spacing.lg, paddingBottom: Spacing.xxl, flexGrow: 1 },
  newButton: { marginBottom: Spacing.lg },
  separator: { height: Spacing.md },
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
  rowBody: { flex: 1, gap: 2 },
  title: { ...Typography.bodyStrong, color: Colors.text },
  meta: { ...Typography.caption, color: Colors.textMuted },
  draftDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
}));
