import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState, ScreenLoader } from '@/components/ui/screen';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/auth-context';
import { recordCheckout } from '@/lib/db/orders';
import { ShopifyError, formatMoney } from '@/lib/shopify/client';
import { useCart } from '@/lib/shopify/cart-context';
import type { CartLine } from '@/lib/shopify/types';

/**
 * The cart, and the jump to checkout.
 *
 * Checkout itself is Shopify's hosted flow opened in an in-app browser. That's
 * deliberate: it means payment details, taxes, shipping rates, and discount
 * codes are all handled by Shopify, and this app never touches card data — so
 * there's no PCI surface here at all.
 */
export default function CartScreen() {
  const Colors = useThemeColors();
  const styles = useStyles();
  const router = useRouter();
  const { cart, loading, busy, setQuantity, removeItem, refresh } = useCart();
  const { user } = useAuth();
  const [checkingOut, setCheckingOut] = useState(false);

  async function checkout() {
    if (!cart) return;
    setCheckingOut(true);
    try {
      // Record the order before opening checkout, not after. Plenty of people
      // complete a purchase and never come back to the app, and their order
      // still has to appear in their history.
      if (user) {
        await recordCheckout(user.uid, cart).catch((error: unknown) =>
          console.warn('[cart] could not record the order', error),
        );
      }

      await WebBrowser.openBrowserAsync(cart.checkoutUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        dismissButtonStyle: 'close',
        toolbarColor: Colors.background,
        controlsColor: Colors.primary,
      });
      // Back from the browser. If the order went through, Shopify stops
      // resolving the cart and this empties it.
      await refresh();
    } catch (error) {
      Alert.alert(
        'Could not open checkout',
        error instanceof ShopifyError ? error.userMessage : 'Please try again.',
      );
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading) return <ScreenLoader />;

  const lines = cart?.lines ?? [];

  if (lines.length === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
        <Stack.Screen options={{ title: 'Cart' }} />
        <EmptyState
          title="Your cart is empty"
          message="Nothing in here yet."
          action={
            <Button label="Browse the shop" fullWidth={false} onPress={() => router.back()} />
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Cart' }} />

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {lines.map((line) => (
          <CartRow
            key={line.id}
            line={line}
            disabled={busy}
            onDecrease={() => void setQuantity(line.id, line.quantity - 1)}
            onIncrease={() => void setQuantity(line.id, line.quantity + 1)}
            onRemove={() => void removeItem(line.id)}
          />
        ))}
      </ScrollView>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>
            {cart ? formatMoney(cart.cost.subtotalAmount) : ''}
          </Text>
        </View>
        <Text style={styles.summaryNote}>
          Shipping and tax are calculated at checkout.
        </Text>
        <Button
          label="Checkout"
          onPress={checkout}
          loading={checkingOut}
          disabled={busy}
        />
      </View>
    </SafeAreaView>
  );
}

function CartRow({
  line,
  disabled,
  onDecrease,
  onIncrease,
  onRemove,
}: {
  line: CartLine;
  disabled: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
}) {
  const Colors = useThemeColors();
  const styles = useStyles();
  const image = line.merchandise.image ?? line.merchandise.product.featuredImage;
  // Shopify uses "Default Title" for products with no real variants.
  const variantLabel =
    line.merchandise.title && line.merchandise.title !== 'Default Title'
      ? line.merchandise.title
      : null;

  return (
    <View style={styles.row}>
      {image ? (
        <Image
          source={{ uri: image.url }}
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
          {line.merchandise.product.title}
        </Text>
        {variantLabel ? <Text style={styles.rowVariant}>{variantLabel}</Text> : null}
        <Text style={styles.rowPrice}>{formatMoney(line.cost.totalAmount)}</Text>

        <View style={styles.quantity}>
          <QuantityButton icon="remove" onPress={onDecrease} disabled={disabled} />
          <Text style={styles.quantityValue}>{line.quantity}</Text>
          <QuantityButton icon="add" onPress={onIncrease} disabled={disabled} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove from cart"
            onPress={onRemove}
            disabled={disabled}
            hitSlop={8}
            style={styles.remove}>
            <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function QuantityButton({
  icon,
  onPress,
  disabled,
}: {
  icon: 'add' | 'remove';
  onPress: () => void;
  disabled: boolean;
}) {
  const Colors = useThemeColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={icon === 'add' ? 'Increase quantity' : 'Decrease quantity'}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.quantityButton,
        pressed && styles.quantityButtonPressed,
        disabled && styles.quantityButtonDisabled,
      ]}>
      <Ionicons name={icon} size={16} color={Colors.text} />
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
  },
  thumbnailFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...Typography.bodyStrong,
  },
  rowVariant: {
    ...Typography.caption,
  },
  rowPrice: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  quantity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonPressed: {
    backgroundColor: Colors.primaryTint,
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityValue: {
    ...Typography.bodyStrong,
    minWidth: 18,
    textAlign: 'center',
  },
  remove: {
    marginLeft: 'auto',
  },
  summary: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  summaryLabel: {
    ...Typography.heading,
  },
  summaryValue: {
    ...Typography.heading,
  },
  summaryNote: {
    ...Typography.caption,
    marginBottom: Spacing.sm,
  },
}));
