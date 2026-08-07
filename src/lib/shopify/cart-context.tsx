import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { isShopConfigured } from '@/lib/shopify/client';
import {
  addCartLines,
  createCart,
  fetchCart,
  removeCartLine,
  updateCartLine,
} from '@/lib/shopify/store';
import type { Cart } from '@/lib/shopify/types';

/**
 * The shopping cart.
 *
 * Shopify owns the cart — we keep its id in AsyncStorage so it survives an app
 * restart, and re-fetch it on launch. Carts belong to the device, not the
 * account: someone can shop without signing in, and that's how Shopify's own
 * apps behave.
 */

const CART_ID_KEY = 'shopify.cartId';

type CartContextValue = {
  cart: Cart | null;
  /** True while the stored cart is being restored at launch. */
  loading: boolean;
  /** True during any mutation, so buttons can show progress. */
  busy: boolean;
  itemCount: number;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  setQuantity: (lineId: string, quantity: number) => Promise<void>;
  removeItem: (lineId: string) => Promise<void>;
  refresh: () => Promise<void>;
  clearLocalCart: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  // Nothing to restore when the store isn't configured, so don't start in a
  // loading state we'd immediately have to clear.
  const [loading, setLoading] = useState(() => isShopConfigured());
  const [busy, setBusy] = useState(false);

  /** Persist the id alongside the cart so the two never disagree. */
  const remember = useCallback(async (next: Cart | null) => {
    setCart(next);
    if (next) {
      await AsyncStorage.setItem(CART_ID_KEY, next.id);
    } else {
      await AsyncStorage.removeItem(CART_ID_KEY);
    }
  }, []);

  // Restore the cart at launch.
  useEffect(() => {
    if (!isShopConfigured()) return;

    let cancelled = false;
    AsyncStorage.getItem(CART_ID_KEY)
      .then(async (cartId) => {
        if (!cartId) return null;
        // A cart that has been checked out, or that expired, resolves to null.
        return fetchCart(cartId);
      })
      .then(async (restored) => {
        if (cancelled) return;
        if (restored) {
          setCart(restored);
        } else {
          await AsyncStorage.removeItem(CART_ID_KEY);
        }
      })
      .catch((error: unknown) => console.warn('[cart] could not restore', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const addItem = useCallback(
    async (variantId: string, quantity = 1) => {
      setBusy(true);
      try {
        const line = { merchandiseId: variantId, quantity };
        if (!cart) {
          await remember(await createCart([line]));
          return;
        }
        try {
          await remember(await addCartLines(cart.id, [line]));
        } catch (error) {
          // The stored cart may have been completed or expired between the
          // restore and now; start a fresh one rather than failing the tap.
          console.warn('[cart] add failed, starting a new cart', error);
          await remember(await createCart([line]));
        }
      } finally {
        setBusy(false);
      }
    },
    [cart, remember],
  );

  const setQuantity = useCallback(
    async (lineId: string, quantity: number) => {
      if (!cart) return;
      setBusy(true);
      try {
        if (quantity <= 0) {
          await remember(await removeCartLine(cart.id, lineId));
        } else {
          await remember(await updateCartLine(cart.id, lineId, quantity));
        }
      } finally {
        setBusy(false);
      }
    },
    [cart, remember],
  );

  const removeItem = useCallback(
    async (lineId: string) => {
      if (!cart) return;
      setBusy(true);
      try {
        await remember(await removeCartLine(cart.id, lineId));
      } finally {
        setBusy(false);
      }
    },
    [cart, remember],
  );

  /**
   * Re-read the cart from Shopify. Called after returning from checkout —
   * a completed cart comes back null, which empties the badge.
   */
  const refresh = useCallback(async () => {
    if (!cart) return;
    try {
      const latest = await fetchCart(cart.id);
      await remember(latest);
    } catch (error) {
      console.warn('[cart] refresh failed', error);
    }
  }, [cart, remember]);

  const clearLocalCart = useCallback(async () => {
    await remember(null);
  }, [remember]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      busy,
      itemCount: cart?.totalQuantity ?? 0,
      addItem,
      setQuantity,
      removeItem,
      refresh,
      clearLocalCart,
    }),
    [cart, loading, busy, addItem, setQuantity, removeItem, refresh, clearLocalCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used inside <CartProvider>.');
  }
  return context;
}
