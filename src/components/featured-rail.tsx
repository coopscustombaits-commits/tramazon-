import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles } from '@/constants/theme-context';
import { formatMoney, isShopConfigured } from '@/lib/shopify/client';
import { fetchCollectionProducts } from '@/lib/shopify/store';
import type { ProductSummary } from '@/lib/shopify/types';

/**
 * The Shopify collection this reads.
 *
 * Coop controls what's featured by adding products to a collection called
 * "Featured" in the Shopify admin — no app deploy, no second list to keep in
 * step with the store.
 */
export const FEATURED_COLLECTION_HANDLE = 'featured';

/**
 * A horizontal shelf of featured products, for the top of the feed.
 *
 * Renders nothing when the shop isn't configured, when the collection doesn't
 * exist, or when it's empty — the feed shouldn't grow a "Featured" heading
 * over a blank space, and a store that isn't set up yet shouldn't show an
 * error to anglers.
 */
export function FeaturedRail() {
  const router = useRouter();
  const styles = useStyles();
  const [products, setProducts] = useState<ProductSummary[]>([]);

  useEffect(() => {
    if (!isShopConfigured()) return;
    let cancelled = false;
    fetchCollectionProducts(FEATURED_COLLECTION_HANDLE)
      .then((page) => {
        if (!cancelled) setProducts(page.products.slice(0, 10));
      })
      .catch((error: unknown) => {
        // A missing collection is a normal state, not a failure to report.
        console.warn('[featured] could not load', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (products.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Featured</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See the whole shop"
          onPress={() => router.push('/(tabs)/shop')}>
          <Text style={styles.link}>Shop all</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}>
        {products.map((product) => (
          <Pressable
            key={product.id}
            accessibilityRole="button"
            accessibilityLabel={product.title}
            onPress={() => router.push(`/product/${product.handle}`)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
            <Image
              source={{ uri: product.featuredImage?.url }}
              style={styles.image}
              contentFit="cover"
              transition={150}
              accessibilityIgnoresInvertColors
            />
            <Text style={styles.name} numberOfLines={2}>
              {product.title}
            </Text>
            <Text style={styles.price}>
              {formatMoney(product.priceRange.minVariantPrice)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  section: { gap: Spacing.sm, paddingBottom: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...Typography.heading, color: Colors.text },
  link: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },
  rail: { gap: Spacing.md, paddingVertical: Spacing.xs },
  card: { width: 132, gap: Spacing.xs },
  cardPressed: { opacity: 0.85 },
  image: {
    width: 132,
    height: 132,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceMuted,
  },
  name: { ...Typography.caption, color: Colors.text, fontWeight: '600' },
  price: { ...Typography.caption, color: Colors.textMuted },
}));
