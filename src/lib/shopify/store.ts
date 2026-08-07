import { ShopifyError, storefront } from '@/lib/shopify/client';
import {
  CART_CREATE_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_REMOVE_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_QUERY,
  PRODUCT_QUERY,
  PRODUCTS_QUERY,
} from '@/lib/shopify/queries';
import type {
  Cart,
  CartLine,
  Product,
  ProductSummary,
  ProductVariant,
  ShopifyImage,
} from '@/lib/shopify/types';

// Pure variant logic lives in `variants.ts` so it can be unit tested without
// pulling in the network client. Re-exported so screens have one import.
export { defaultSelection, findVariant, hasRealOptions } from '@/lib/shopify/variants';

/**
 * Typed wrappers around the Storefront queries. Everything here flattens
 * Shopify's `edges { node }` connections, so screens deal in plain arrays.
 */

type Edges<T> = { edges: { node: T; cursor?: string }[] };

function nodes<T>(connection: Edges<T> | null | undefined): T[] {
  return connection?.edges.map((edge) => edge.node) ?? [];
}

export const PRODUCTS_PAGE_SIZE = 12;

export type ProductPage = {
  products: ProductSummary[];
  cursor: string | null;
  hasMore: boolean;
};

export async function fetchProducts(
  cursor: string | null = null,
  search?: string,
): Promise<ProductPage> {
  const data = await storefront<{
    products: Edges<ProductSummary> & {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  }>(PRODUCTS_QUERY, {
    first: PRODUCTS_PAGE_SIZE,
    after: cursor,
    query: search?.trim() || null,
  });

  return {
    products: nodes(data.products),
    cursor: data.products.pageInfo.endCursor,
    hasMore: data.products.pageInfo.hasNextPage,
  };
}

export async function fetchProduct(handle: string): Promise<Product | null> {
  const data = await storefront<{
    product:
      | (Omit<Product, 'images' | 'variants'> & {
          images: Edges<ShopifyImage>;
          variants: Edges<ProductVariant>;
        })
      | null;
  }>(PRODUCT_QUERY, { handle });

  if (!data.product) return null;

  return {
    ...data.product,
    images: nodes(data.product.images),
    variants: nodes(data.product.variants),
  };
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

type RawCart = Omit<Cart, 'lines'> & { lines: Edges<CartLine> };

type CartMutationResult = {
  cart: RawCart | null;
  userErrors: { field: string[] | null; message: string }[];
};

function normalizeCart(cart: RawCart | null): Cart | null {
  if (!cart) return null;
  return { ...cart, lines: nodes(cart.lines) };
}

/**
 * Shopify reports business-level problems ("only 2 left in stock") in
 * `userErrors` with a 200 response, separately from GraphQL errors.
 */
function unwrap(result: CartMutationResult): Cart {
  if (result.userErrors.length > 0) {
    const message = result.userErrors.map((error) => error.message).join(' ');
    throw new ShopifyError(`Cart mutation rejected: ${message}`, message);
  }
  const cart = normalizeCart(result.cart);
  if (!cart) throw new ShopifyError('Cart mutation returned no cart.');
  return cart;
}

export async function createCart(
  lines: { merchandiseId: string; quantity: number }[] = [],
): Promise<Cart> {
  const data = await storefront<{ cartCreate: CartMutationResult }>(
    CART_CREATE_MUTATION,
    { lines },
  );
  return unwrap(data.cartCreate);
}

/**
 * Fetch an existing cart. Returns null when the id is stale — carts expire
 * after about 10 days of inactivity, and completed ones stop resolving.
 */
export async function fetchCart(cartId: string): Promise<Cart | null> {
  const data = await storefront<{ cart: RawCart | null }>(CART_QUERY, { id: cartId });
  return normalizeCart(data.cart);
}

export async function addCartLines(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[],
): Promise<Cart> {
  const data = await storefront<{ cartLinesAdd: CartMutationResult }>(
    CART_LINES_ADD_MUTATION,
    { cartId, lines },
  );
  return unwrap(data.cartLinesAdd);
}

export async function updateCartLine(
  cartId: string,
  lineId: string,
  quantity: number,
): Promise<Cart> {
  const data = await storefront<{ cartLinesUpdate: CartMutationResult }>(
    CART_LINES_UPDATE_MUTATION,
    { cartId, lines: [{ id: lineId, quantity }] },
  );
  return unwrap(data.cartLinesUpdate);
}

export async function removeCartLine(cartId: string, lineId: string): Promise<Cart> {
  const data = await storefront<{ cartLinesRemove: CartMutationResult }>(
    CART_LINES_REMOVE_MUTATION,
    { cartId, lineIds: [lineId] },
  );
  return unwrap(data.cartLinesRemove);
}
