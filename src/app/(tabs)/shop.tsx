import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppHeader } from '@/components/app-header';
import { ProductTile } from '@/components/product-tile';
import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { ShopifyError, isShopConfigured } from '@/lib/shopify/client';
import { useCart } from '@/lib/shopify/cart-context';
import {
  fetchCollectionProducts,
  fetchCollections,
  fetchProducts,
  type ProductPage,
} from '@/lib/shopify/store';
import type { Collection, ProductSummary } from '@/lib/shopify/types';

/** How long to wait after the last keystroke before searching. */
const SEARCH_DEBOUNCE_MS = 350;

/** Sentinel for "no category filter". */
const ALL = '__all__';

export default function ShopScreen() {
  const Colors = useThemeColors();
  const styles = useStyles();
  const router = useRouter();
  const { itemCount } = useCart();

  const configured = isShopConfigured();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollection, setActiveCollection] = useState<string>(ALL);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  /**
   * Results are stamped with the filter they belong to. That makes "loading"
   * something we can derive rather than a flag to keep in sync, and stops a
   * slow response for one category landing under another.
   */
  const filterKey = `${activeCollection}|${search}`;
  const [result, setResult] = useState<{
    key: string;
    products: ProductSummary[];
    cursor: string | null;
    hasMore: boolean;
    error: string | null;
  } | null>(null);

  const loading = configured && result?.key !== filterKey;
  const products = result?.key === filterKey ? result.products : [];
  const error = result?.key === filterKey ? result.error : null;

  // Debounce typing — one request per pause, not one per letter.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(
    (nextCursor: string | null = null): Promise<ProductPage> =>
      activeCollection === ALL || search
        ? // Searching looks across the whole store; a category filter would
          // hide the thing people are searching for.
          fetchProducts(nextCursor, search || undefined)
        : fetchCollectionProducts(activeCollection, nextCursor),
    [activeCollection, search],
  );

  const failureMessage = useCallback((caught: unknown) => {
    console.warn('[shop] load failed', caught);
    return caught instanceof ShopifyError
      ? caught.userMessage
      : 'Could not load the store. Pull down to try again.';
  }, []);

  // Categories, once.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    fetchCollections()
      .then((result) => {
        if (!cancelled) setCollections(result);
      })
      .catch((caught: unknown) => console.warn('[shop] collections failed', caught));
    return () => {
      cancelled = true;
    };
  }, [configured]);

  // Products, whenever the filter or search changes.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;

    load()
      .then((page) => {
        if (cancelled) return;
        setResult({ key: filterKey, ...page, error: null });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setResult({
          key: filterKey,
          products: [],
          cursor: null,
          hasMore: false,
          error: failureMessage(caught),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [configured, load, filterKey, failureMessage]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const page = await load();
      setResult({ key: filterKey, ...page, error: null });
    } catch (caught) {
      setResult({
        key: filterKey,
        products: [],
        cursor: null,
        hasMore: false,
        error: failureMessage(caught),
      });
    } finally {
      setRefreshing(false);
    }
  }, [load, filterKey, failureMessage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !result || result.key !== filterKey || !result.hasMore || !result.cursor) {
      return;
    }
    setLoadingMore(true);
    try {
      const page = await load(result.cursor);
      setResult((current) => {
        // A filter change while this was in flight wins.
        if (!current || current.key !== filterKey) return current;
        const seen = new Set(current.products.map((product) => product.id));
        return {
          ...current,
          products: [
            ...current.products,
            ...page.products.filter((product) => !seen.has(product.id)),
          ],
          cursor: page.cursor,
          hasMore: page.hasMore,
        };
      });
    } catch (caught) {
      console.warn('[shop] load more failed', caught);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, result, filterKey, load]);

  const categories = useMemo(
    () => [{ id: ALL, handle: ALL, title: 'All', image: null } as Collection, ...collections],
    [collections],
  );

  if (!configured) {
    return (
      <Screen padded={false}>
        <AppHeader title="Shop" />
        <EmptyState
          title="Store coming soon"
          message="The bait lineup will show up here as soon as the Shopify store is connected."
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <AppHeader
        title="Shop"
        actions={[
          {
            icon: 'star-outline',
            label: 'Bait reviews',
            onPress: () => router.push('/baits'),
          },
          {
            icon: 'heart-outline',
            label: 'Wishlist',
            onPress: () => router.push('/wishlist'),
          },
          {
            icon: itemCount > 0 ? 'bag-handle' : 'bag-handle-outline',
            label: `Cart, ${itemCount} items`,
            badge: itemCount,
            onPress: () => router.push('/cart'),
          },
        ]}
      />

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={Colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search baits"
          placeholderTextColor={Colors.textFaint}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchInput.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
            onPress={() => setSearchInput('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {collections.length > 0 && !search ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}>
          {categories.map((collection) => {
            const active = activeCollection === collection.handle;
            return (
              <Pressable
                key={collection.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setActiveCollection(collection.handle)}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {collection.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {loading ? (
        <ScreenLoader />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(product) => product.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ProductTile
              product={item}
              onPress={() => router.push(`/product/${item.handle}`)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title={
                error ? 'Store unavailable' : search ? 'Nothing found' : 'Nothing in stock'
              }
              message={
                error ??
                (search
                  ? `No baits match "${search}".`
                  : 'New baits are on the way — check back soon.')
              }
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={styles.footer} color={Colors.primary} />
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 16,
    color: Colors.text,
  },
  categories: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryTint,
  },
  chipLabel: {
    ...Typography.caption,
    color: Colors.text,
  },
  chipLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
    flexGrow: 1,
  },
  row: {
    gap: Spacing.lg,
  },
  footer: {
    paddingVertical: Spacing.xl,
  },
}));
