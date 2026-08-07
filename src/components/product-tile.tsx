import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { formatMoney } from '@/lib/shopify/client';
import type { ProductSummary } from '@/lib/shopify/types';

/** One product in the shop grid or the wishlist. */
export function ProductTile({
  product,
  onPress,
  /** Optional heart in the corner; omitted where a heart makes no sense. */
  saved,
  onToggleSaved,
}: {
  product: ProductSummary;
  onPress: () => void;
  saved?: boolean;
  onToggleSaved?: () => void;
}) {
  const Colors = useThemeColors();
  const styles = useStyles();
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

        {onToggleSaved ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from wishlist' : 'Save to wishlist'}
            accessibilityState={{ selected: saved }}
            onPress={onToggleSaved}
            hitSlop={8}
            style={styles.heart}>
            <Ionicons
              name={saved ? 'heart' : 'heart-outline'}
              size={18}
              color={saved ? Colors.danger : Colors.textInverse}
            />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {product.title}
      </Text>
      <Text style={styles.price}>{priceLabel}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
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
  heart: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
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
}));
