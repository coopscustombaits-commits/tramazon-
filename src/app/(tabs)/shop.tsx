import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '@/components/app-header';
import { EmptyState, Screen, ScreenLoader } from '@/components/ui/screen';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { ShopifyError, formatMoney, isShopConfigured } from '@/lib/shopify/client';
import { useCart } from '@/lib/shopify/cart-context';
import { fetchProducts } from '@/lib/shopify/store';
import type { ProductSummary } from '@/lib/shopify/types';

export default function ShopScreen() {
  const router = useRouter();
  const { itemCount } = useCart();

  const configured = isShopConfigured();

  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  // No fetch happens without credentials, so don't start out loading.
  const [loading, setLoading] = useState(configured);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyFirstPage = useCallback(
    (page: { products: ProductSummary[]; cursor: string | null; hasMore: boolean }) => {
      setProducts(page.products);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      setError(null);
    },
    [],
  );

  const handleFailure = useCallback((caught: unknown) => {
    console.warn('[shop] load failed', caught);
    setError(
      caught instanceof ShopifyError
        ? caught.userMessage
        : 'Could not load the store. Pull down to try again.',
    );
  }, []);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    fetchProducts()
      .then((page) => {
        if (!cancelled) applyFirstPage(page);
      })
      .catch((caught: unknown) => {
        if (!cancelled) handleFailure(caught);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, applyFirstPage, handleFailure]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      applyFirstPage(await fetchProducts());
    } catch (caught) {
      handleFailure(caught);
    } finally {
      setRefreshing(false);
    }
  }, [applyFirstPage, handleFailure]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchProducts(cursor);
      setProducts((current) => {
        const seen = new Set(current.map((product) => product.id));
        return [...current, ...page.products.filter((product) => !seen.has(product.id))];
      });
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (caught) {
      console.warn('[shop] load more failed', caught);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore]);

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

  if (loading) {
    return <ScreenLoader />;
  }

  return (
    <Screen padded={false}>
      <AppHeader
        title="Shop"
        action={{
          icon: itemCount > 0 ? 'bag-handle' : 'bag-handle-outline',
          label: `Cart, ${itemCount} items`,
          onPress: () => router.push('/cart'),
        }}
      />

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
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ProductTile product={item} onPress={() => router.push(`/product/${item.handle}`)} />
        )}
        ListEmptyComponent={
          <EmptyState
            title={error ? 'Store unavailable' : 'Nothing in stock'}
            message={error ?? 'New baits are on the way — check back soon.'}
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

function ProductTile({
  product,
  onPress,
}: {
  product: ProductSummary;
  onPress: () => void;
}) {
  const { minVariantPrice, maxVariantPrice } = product.priceRange;
  const priceLabel =
    minVariantPrice.amount === maxVariantPrice.amount
      ? formatMoney(minVariantPrice)
      : `From ${formatMoney(minVariantPrice)}`;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
      <View style={styles.imageWrapper}>
        {product.featuredImage ? (
          <Image
            source={{ uri: product.featuredImage.url }}
            style={styles.image}
            contentFit="cover"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="fish-outline" size={28} color={Colors.textFaint} />
          </View>
        )}
        {!product.availableForSale ? (
          <View style={styles.soldOut}>
            <Text style={styles.soldOutLabel}>Sold out</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {product.title}
      </Text>
      <Text style={styles.price}>{priceLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: Spacing.lg,
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
  tile: {
    flex: 1,
    gap: Spacing.xs,
  },
  tilePressed: {
    opacity: 0.85,
  },
  imageWrapper: {
    aspectRatio: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOut: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: Colors.overlay,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  soldOutLabel: {
    color: Colors.textInverse,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    ...Typography.body,
    fontWeight: '500',
  },
  price: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '700',
  },
});
