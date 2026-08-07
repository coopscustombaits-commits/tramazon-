import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostCard } from '@/components/post-card';
import { Button } from '@/components/ui/button';
import { EmptyState, ScreenLoader } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { useBlocked } from '@/lib/db/blocked-context';
import { fetchPostsBySpecies } from '@/lib/db/posts';
import { speciesLabel } from '@/lib/species';
import type { Post } from '@/types/models';

/** One species hub: approved catches of that fish, newest first. */
export default function SpeciesHubScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();
  const { user } = useAuth();
  const { filterBlocked } = useBlocked();

  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetchPostsBySpecies(slug)
      .then((page) => {
        if (cancelled) return;
        setPosts(page.posts);
        setCursor(page.cursor);
        setHasMore(page.hasMore);
      })
      .catch((error: unknown) => console.warn('[species] load failed', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const loadMore = useCallback(async () => {
    if (!slug || !hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchPostsBySpecies(slug, cursor);
      setPosts((current) => {
        const seen = new Set(current.map((post) => post.id));
        return [...current, ...page.posts.filter((post) => !seen.has(post.id))];
      });
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (error) {
      console.warn('[species] load more failed', error);
    } finally {
      setLoadingMore(false);
    }
  }, [slug, cursor, hasMore, loadingMore]);

  if (loading) return <ScreenLoader />;

  const label = slug ? speciesLabel(slug) : 'Species';

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: label }} />

      <FlatList
        data={filterBlocked(posts)}
        keyExtractor={(post) => post.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUid={user?.uid ?? ''}
            onPress={() => router.push(`/post/${item.id}`)}
            onPressAuthor={() => router.push(`/user/${item.authorId}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title={`No ${label.toLowerCase()} yet`}
            message="Be the first — tag the species when you post your catch."
            action={
              <Button
                label="Post a catch"
                fullWidth={false}
                onPress={() => router.push('/(tabs)/create')}
              />
            }
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={styles.footer} color={Colors.primary} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const useStyles = makeStyles(() => ({
  screen: { flex: 1 },
  list: { padding: Spacing.lg, paddingBottom: Spacing.xxl, flexGrow: 1 },
  separator: { height: Spacing.lg },
  footer: { paddingVertical: Spacing.xl },
}));
