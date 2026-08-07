import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
import { EmptyState, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { ShopifyError, formatMoney } from '@/lib/shopify/client';
import { useAuth } from '@/lib/auth/auth-context';
import { addToWishlist, removeFromWishlist, subscribeToWishlist } from '@/lib/db/wishlist';
import { useCart } from '@/lib/shopify/cart-context';
import {
  defaultSelection,
  fetchProduct,
  findVariant,
  hasRealOptions,
} from '@/lib/shopify/store';
import type { Product } from '@/lib/shopify/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProductScreen() {
  const Colors = useThemeColors();
  const styles = useStyles();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const { addItem, busy, itemCount } = useCart();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  // Wishlist state for this product, live so the heart matches other screens.
  useEffect(() => {
    if (!user || !product) return;
    return subscribeToWishlist(user.uid, (items) =>
      setSaved(items.some((item) => item.productId === product.id)),
    );
  }, [user, product]);

  async function toggleSaved() {
    if (!user || !product) return;
    const next = !saved;
    setSaved(next);
    try {
      if (next) {
        await addToWishlist(user.uid, product);
      } else {
        await removeFromWishlist(user.uid, product.id);
      }
    } catch (error) {
      setSaved(!next);
      console.warn('[product] wishlist toggle failed', error);
    }
  }

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    fetchProduct(handle)
      .then((result) => {
        if (cancelled) return;
        setProduct(result);
        if (result) setSelection(defaultSelection(result));
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        console.warn('[product] load failed', caught);
        setError(
          caught instanceof ShopifyError ? caught.userMessage : 'Could not load this product.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const variant = useMemo(
    () => (product ? findVariant(product, selection) : null),
    [product, selection],
  );

  const handleAdd = useCallback(async () => {
    if (!variant) return;
    try {
      await addItem(variant.id, 1);
      router.push('/cart');
    } catch (caught) {
      Alert.alert(
        'Could not add to cart',
        caught instanceof ShopifyError ? caught.userMessage : 'Please try again.',
      );
    }
  }, [variant, addItem, router]);

  if (loading) return <ScreenLoader />;

  if (!product) {
    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ title: 'Product' }} />
        <EmptyState
          title={error ? 'Store unavailable' : 'Product not found'}
          message={error ?? 'This bait may have sold out or been retired.'}
        />
      </SafeAreaView>
    );
  }

  const images = product.images.length > 0 ? product.images : [];
  const heroImages = variant?.image ? [variant.image, ...images] : images;
  const price = variant?.price ?? product.priceRange.minVariantPrice;
  const compareAt = variant?.compareAtPrice;
  const onSale =
    compareAt && Number.parseFloat(compareAt.amount) > Number.parseFloat(price.amount);

  const soldOut = variant ? !variant.availableForSale : !product.availableForSale;

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: product.title,
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={saved ? 'Remove from wishlist' : 'Save to wishlist'}
                accessibilityState={{ selected: saved }}
                hitSlop={8}
                onPress={toggleSaved}>
                <Ionicons
                  name={saved ? 'heart' : 'heart-outline'}
                  size={22}
                  color={saved ? Colors.danger : Colors.primary}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Cart, ${itemCount} items`}
                hitSlop={8}
                onPress={() => router.push('/cart')}>
                <Text style={styles.cartLink}>Cart{itemCount > 0 ? ` (${itemCount})` : ''}</Text>
              </Pressable>
            </View>
          ),
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {heroImages.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.gallery}>
            {heroImages.map((image, index) => (
              <Image
                key={`${image.url}-${index}`}
                source={{ uri: image.url }}
                style={styles.heroImage}
                contentFit="cover"
                transition={150}
                accessibilityLabel={image.altText ?? product.title}
                accessibilityIgnoresInvertColors
              />
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.body}>
          <Text style={styles.title}>{product.title}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatMoney(price)}</Text>
            {onSale ? <Text style={styles.compareAt}>{formatMoney(compareAt)}</Text> : null}
          </View>

          {hasRealOptions(product)
            ? product.options.map((option) => (
                <View key={option.id} style={styles.option}>
                  <Text style={styles.optionName}>{option.name}</Text>
                  <View style={styles.optionValues}>
                    {option.values.map((value) => {
                      const active = selection[option.name] === value;
                      // Grey out combinations the store doesn't actually sell.
                      const available = product.variants.some(
                        (entry) =>
                          entry.availableForSale &&
                          entry.selectedOptions.some(
                            (selected) =>
                              selected.name === option.name && selected.value === value,
                          ),
                      );
                      return (
                        <Pressable
                          key={value}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() =>
                            setSelection((current) => ({ ...current, [option.name]: value }))
                          }
                          style={[
                            styles.chip,
                            active && styles.chipActive,
                            !available && styles.chipUnavailable,
                          ]}>
                          <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                            {value}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))
            : null}

          {product.description ? (
            <Text style={styles.description}>{product.description}</Text>
          ) : null}

          <Button
            label={soldOut ? 'Sold out' : 'Add to cart'}
            onPress={handleAdd}
            loading={busy}
            disabled={soldOut || !variant}
          />

          {!variant && hasRealOptions(product) ? (
            <Text style={styles.hint}>That combination isn&apos;t available.</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  cartLink: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  gallery: {
    backgroundColor: Colors.surfaceMuted,
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  body: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  title: {
    ...Typography.title,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    marginTop: -Spacing.sm,
  },
  price: {
    ...Typography.heading,
    color: Colors.primary,
  },
  compareAt: {
    ...Typography.caption,
    textDecorationLine: 'line-through',
  },
  option: {
    gap: Spacing.sm,
  },
  optionName: {
    ...Typography.label,
  },
  optionValues: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
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
  chipUnavailable: {
    opacity: 0.4,
  },
  chipLabel: {
    ...Typography.body,
  },
  chipLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  description: {
    ...Typography.body,
    color: Colors.textMuted,
  },
  hint: {
    ...Typography.caption,
    color: Colors.danger,
    textAlign: 'center',
  },
}));
