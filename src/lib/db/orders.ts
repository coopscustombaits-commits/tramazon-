import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { paths } from '@/lib/db/paths';
import { db } from '@/lib/firebase';
import type { Cart } from '@/lib/shopify/types';
import { SCHEMA_VERSION, type Order } from '@/types/models';

/**
 * Order records.
 *
 * Shopify owns orders, but the Storefront API can't list them without a
 * Shopify customer login — and asking people to keep a second password would
 * be a poor trade. Instead:
 *
 *   1. The app writes a record here the moment checkout opens, capturing what
 *      was in the cart.
 *   2. A Cloud Function subscribed to Shopify's `orders/*` webhooks matches
 *      the order back by cart id and fills in the number, status, and
 *      tracking. See docs/SETUP.md.
 *
 * So the list is never empty and never stale, and nobody logs in twice.
 */

export function subscribeToOrders(
  uid: string,
  onChange: (orders: Order[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, paths.userOrders(uid)), orderBy('createdAt', 'desc')),
    (snapshot) =>
      onChange(snapshot.docs.map((entry) => ({ ...(entry.data() as Order), id: entry.id }))),
    (error) => onError?.(error),
  );
}

/**
 * Record a checkout attempt. Called when the checkout browser opens, not when
 * it closes — the customer may complete the purchase and never return to the
 * app, and that order still has to appear.
 */
export async function recordCheckout(uid: string, cart: Cart): Promise<string> {
  const reference = await addDoc(collection(db, paths.userOrders(uid)), {
    schemaVersion: SCHEMA_VERSION,
    cartId: cart.id,
    shopifyOrderId: null,
    orderNumber: null,
    status: 'placed',
    statusUrl: null,
    totalAmount: cart.cost.totalAmount.amount,
    totalCurrency: cart.cost.totalAmount.currencyCode,
    lines: cart.lines.map((line) => ({
      productHandle: line.merchandise.product.handle,
      title: line.merchandise.product.title,
      variantTitle:
        line.merchandise.title && line.merchandise.title !== 'Default Title'
          ? line.merchandise.title
          : null,
      quantity: line.quantity,
      imageUrl:
        line.merchandise.image?.url ?? line.merchandise.product.featuredImage?.url ?? null,
    })),
    fulfilledAt: null,
    trackingNumbers: [],
    trackingUrls: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

/** Plain-language label for an order's state. */
export function orderStatusLabel(order: Order): string {
  switch (order.status) {
    case 'placed':
      return 'Order placed';
    case 'paid':
      return 'Paid — getting ready to ship';
    case 'partially_fulfilled':
      return 'Partly shipped';
    case 'fulfilled':
      return 'Shipped';
    case 'cancelled':
      return 'Cancelled';
    case 'refunded':
      return 'Refunded';
    default:
      return 'Processing';
  }
}

export function orderStatusTone(
  order: Order,
): 'neutral' | 'pending' | 'approved' | 'rejected' {
  switch (order.status) {
    case 'fulfilled':
      return 'approved';
    case 'cancelled':
    case 'refunded':
      return 'rejected';
    case 'placed':
    case 'paid':
    case 'partially_fulfilled':
      return 'pending';
    default:
      return 'neutral';
  }
}
