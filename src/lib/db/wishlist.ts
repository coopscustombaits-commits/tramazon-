import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { paths } from '@/lib/db/paths';
import { db } from '@/lib/firebase';
import type { ProductSummary } from '@/lib/shopify/types';
import { SCHEMA_VERSION, type WishlistItem } from '@/types/models';

/**
 * Saved products, stored per user in Firestore rather than on the device, so
 * the list follows someone from their phone to a tablet.
 *
 * Shopify product ids look like `gid://shopify/Product/123`, which contains
 * slashes and so can't be used as a Firestore document id. The numeric tail is
 * used instead, and the full id kept as a field.
 */

export function wishlistDocId(productId: string): string {
  return productId.split('/').pop() ?? productId;
}

export function subscribeToWishlist(
  uid: string,
  onChange: (items: WishlistItem[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, paths.userWishlist(uid)), orderBy('createdAt', 'desc')),
    (snapshot) => onChange(snapshot.docs.map((entry) => entry.data() as WishlistItem)),
    (error) => onError?.(error),
  );
}

export async function addToWishlist(uid: string, product: ProductSummary): Promise<void> {
  await setDoc(doc(db, paths.userWishlistItem(uid, wishlistDocId(product.id))), {
    schemaVersion: SCHEMA_VERSION,
    productId: product.id,
    handle: product.handle,
    title: product.title,
    imageUrl: product.featuredImage?.url ?? null,
    priceAmount: product.priceRange.minVariantPrice.amount,
    priceCurrency: product.priceRange.minVariantPrice.currencyCode,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function removeFromWishlist(uid: string, productId: string): Promise<void> {
  await deleteDoc(doc(db, paths.userWishlistItem(uid, wishlistDocId(productId))));
}
