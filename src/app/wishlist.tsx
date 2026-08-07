import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { removeFromWishlist, subscribeToWishlist } from '@/lib/db/wishlist';
import { formatMoney } from '@/lib/shopify/client';
import type { WishlistItem } from '@/types/models';

/** Saved products. Stored per user in Firestore, so it follows the account. */
export default function WishlistScreen() {
  const Colors = useThemeColors();
  const styles = useStyles();
  const router = useRouter();
  const { user } = useAuth();

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToWishlist(
      user.uid,
      (next) => {
        setItems(next);
        setLoaded(true);
      },
      (error) => {
        console.warn('[wishlist] subscription failed', error);
        setLoaded(true);
      },
    );
  }, [user]);

  if (!loaded) return <ScreenLoader />;

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Wishlist' }} />

      <FlatList
        data={items}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/product/${item.handle}`)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.thumbnail}
                contentFit="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailFallback]}>
                <Ionicons name="fish-outline" size={22} color={Colors.textFaint} />
              </View>
            )}

            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.rowPrice}>
                {formatMoney({ amount: item.priceAmount, currencyCode: item.priceCurrency })}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.title} from wishlist`}
              hitSlop={8}
              onPress={() => user && void removeFromWishlist(user.uid, item.productId)}>
              <Ionicons name="heart" size={22} color={Colors.danger} />
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Nothing saved yet"
            message="Tap the heart on any bait to keep it here for later."
            action={
              <Button
                label="Browse the shop"
                fullWidth={false}
                onPress={() => router.back()}
              />
            }
          />
        }
      />
    </SafeAreaView>
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.lg, flexGrow: 1 },
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
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
  },
  thumbnailFallback: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...Typography.bodyStrong },
  rowPrice: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },
}));
