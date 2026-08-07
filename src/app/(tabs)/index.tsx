import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

import { AppHeader } from '@/components/app-header';
import { PostCard } from '@/components/post-card';
import { Button } from '@/components/ui/button';
import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useUnreadMessages } from '@/hooks/use-unread-messages';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import { useAuth } from '@/lib/auth/auth-context';
import { useBlocked } from '@/lib/db/blocked-context';
import { fetchFeedPage, type PostPage } from '@/lib/db/posts';
import type { Post } from '@/types/models';

/** The public feed — approved catches, newest first. */
export default function FeedScreen() {
  const Colors = useThemeColors();
  const styles = useStyles();
  const router = useRouter();
  const { user } = useAuth();
  const unread = useUnreadNotifications(user?.uid ?? null);
  const unreadMessages = useUnreadMessages(user?.uid ?? null);
  const { filterBlocked } = useBlocked();

  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyFirstPage = useCallback((page: PostPage) => {
    setPosts(page.posts);
    setCursor(page.cursor);
    setHasMore(page.hasMore);
    setError(null);
  }, []);

  const handleLoadFailure = useCallback((caught: unknown) => {
    console.warn('[feed] failed to load', caught);
    setError('Could not load the feed. Pull down to try again.');
  }, []);

  // Initial load. The `cancelled` flag keeps a slow response from writing to
  // state after the screen is gone.
  useEffect(() => {
    let cancelled = false;
    fetchFeedPage()
      .then((page) => {
        if (!cancelled) applyFirstPage(page);
      })
      .catch((caught: unknown) => {
        if (!cancelled) handleLoadFailure(caught);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyFirstPage, handleLoadFailure]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      applyFirstPage(await fetchFeedPage());
    } catch (caught) {
      handleLoadFailure(caught);
    } finally {
      setRefreshing(false);
    }
  }, [applyFirstPage, handleLoadFailure]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchFeedPage(cursor);
      // Guard against a post arriving twice if it was approved mid-scroll.
      setPosts((current) => {
        const seen = new Set(current.map((post) => post.id));
        return [...current, ...page.posts.filter((post) => !seen.has(post.id))];
      });
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (caught) {
      console.warn('[feed] failed to load more', caught);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore]);

  if (loading) {
    return <ScreenLoader />;
  }

  return (
    <Screen padded={false}>
      <AppHeader
        title="The Feed"
        actions={[
          {
            icon: 'search',
            label: 'Search',
            onPress: () => router.push('/search'),
          },
          {
            icon: 'fish-outline',
            label: 'Species hubs',
            onPress: () => router.push('/species'),
          },
          {
            icon: unreadMessages > 0 ? 'chatbubble' : 'chatbubble-outline',
            label:
              unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : 'Messages',
            badge: unreadMessages,
            onPress: () => router.push('/messages'),
          },
          {
            icon: unread > 0 ? 'notifications' : 'notifications-outline',
            label: unread > 0 ? `Activity, ${unread} unread` : 'Activity',
            badge: unread,
            onPress: () => router.push('/notifications'),
          },
        ]}
      />
      <FlatList
        data={filterBlocked(posts)}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUid={user?.uid ?? ''}
            onPress={() => router.push(`/post/${item.id}`)}
            onPressAuthor={() => router.push(`/user/${item.authorId}`)}
          />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            title={error ? 'Something went wrong' : 'No catches yet'}
            message={
              error ??
              'Be the first — post a photo of your catch and it’ll show up here once Coop approves it.'
            }
            action={
              error ? null : (
                <Button
                  label="Post a catch"
                  fullWidth={false}
                  onPress={() => router.push('/(tabs)/create')}
                />
              )
            }
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={styles.footer} color={Colors.primary} />
          ) : null
        }
      />
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    flexGrow: 1,
  },
  separator: {
    height: Spacing.lg,
  },
  footer: {
    paddingVertical: Spacing.xl,
  },
}));
