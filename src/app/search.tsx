import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostCard } from '@/components/post-card';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { useBlocked } from '@/lib/db/blocked-context';
import { searchPosts } from '@/lib/db/posts';
import { searchUsers } from '@/lib/db/users';
import { normalizeSearchTerm } from '@/lib/search';
import type { Post, UserProfile } from '@/types/models';

const DEBOUNCE_MS = 350;

type Tab = 'anglers' | 'catches';

/** One search's results, tagged with the `tab:term` that produced them. */
type Results = {
  key: string;
  users: UserProfile[];
  posts: Post[];
  failed?: boolean;
};

/**
 * Search anglers and catches.
 *
 * Anglers match on a username prefix. Catches match a whole keyword stored on
 * each post — Firestore has no full-text search, so "pike" finds posts but
 * "pik" doesn't. See docs/ROADMAP.md for the upgrade path.
 */
export default function SearchScreen() {
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();
  const { user } = useAuth();
  const { filterBlocked, blockedIds } = useBlocked();

  const [tab, setTab] = useState<Tab>('anglers');
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(input.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  // Results are stamped with the query that produced them, so "are we still
  // searching?" and "which list do we show?" are derived rather than tracked
  // in their own state — a late response for an old query can't win.
  const queryKey = term.length >= 2 ? `${tab}:${term}` : '';
  const current = results?.key === queryKey ? results : null;
  const searching = queryKey !== '' && current === null;

  useEffect(() => {
    if (!queryKey) return;

    let cancelled = false;
    const load: Promise<Results> =
      tab === 'anglers'
        ? searchUsers(term).then((found) => ({ key: queryKey, users: found, posts: [] }))
        : (async () => {
            const keyword = normalizeSearchTerm(term);
            const found = keyword ? await searchPosts(keyword) : [];
            return { key: queryKey, users: [], posts: found };
          })();

    void load
      .catch((error: unknown) => {
        console.warn('[search] failed', error);
        // Still stamp the key, otherwise the spinner never stops.
        return { key: queryKey, users: [], posts: [], failed: true };
      })
      .then((next) => {
        if (!cancelled) setResults(next);
      });

    return () => {
      cancelled = true;
    };
  }, [queryKey, term, tab]);

  const users = (current?.users ?? []).filter((entry) => !blockedIds.has(entry.uid));
  const posts = filterBlocked(current?.posts ?? []);

  const empty =
    term.length < 2
      ? { title: 'Search', message: 'Find an angler by name, or a catch by what’s in it.' }
      : searching
        ? null
        : current?.failed
          ? {
              title: 'Search failed',
              message: 'Could not reach the server. Check your connection and try again.',
            }
          : {
              title: 'Nothing found',
              message:
                tab === 'anglers'
                  ? `No anglers whose name starts with "${term}".`
                  : `No catches mentioning "${term}". Search matches whole words.`,
            };

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Search' }} />

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={Colors.textFaint} />
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Anglers or catches"
          placeholderTextColor={Colors.textFaint}
          autoCorrect={false}
          autoCapitalize="none"
          autoFocus
          returnKeyType="search"
        />
        {input.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
            onPress={() => setInput('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tabs}>
        {(['anglers', 'catches'] as Tab[]).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && styles.tabActive]}>
            <Text style={[styles.tabLabel, tab === value && styles.tabLabelActive]}>
              {value === 'anglers' ? 'Anglers' : 'Catches'}
            </Text>
          </Pressable>
        ))}
      </View>

      {searching ? <ActivityIndicator style={styles.loader} color={Colors.primary} /> : null}

      {tab === 'anglers' ? (
        <FlatList
          data={users}
          keyExtractor={(entry) => entry.uid}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push(item.uid === user?.uid ? '/(tabs)/profile' : `/user/${item.uid}`)
              }
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <Avatar uri={item.photoURL} name={item.username} size={44} />
              <View style={styles.rowBody}>
                <Text style={styles.username}>{item.username}</Text>
                {item.favoriteSpecies ? (
                  <Text style={styles.meta}>{item.favoriteSpecies}</Text>
                ) : null}
              </View>
              <Text style={styles.meta}>{item.postCount} posts</Text>
            </Pressable>
          )}
          ListEmptyComponent={empty ? <EmptyState {...empty} /> : null}
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(post) => post.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              currentUid={user?.uid ?? ''}
              onPress={() => router.push(`/post/${item.id}`)}
              onPressAuthor={() => router.push(`/user/${item.authorId}`)}
            />
          )}
          ListEmptyComponent={empty ? <EmptyState {...empty} /> : null}
        />
      )}
    </SafeAreaView>
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: { flex: 1, backgroundColor: Colors.background },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    margin: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  input: { flex: 1, minHeight: 44, fontSize: 16, color: Colors.text },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  tab: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tabActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryTint },
  tabLabel: { ...Typography.caption, color: Colors.text },
  tabLabelActive: { color: Colors.primary, fontWeight: '700' },
  loader: { paddingVertical: Spacing.md },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, flexGrow: 1 },
  separator: { height: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  rowPressed: { opacity: 0.85 },
  rowBody: { flex: 1, gap: 2 },
  username: { ...Typography.bodyStrong, color: Colors.text },
  meta: { ...Typography.caption, color: Colors.textMuted },
}));
