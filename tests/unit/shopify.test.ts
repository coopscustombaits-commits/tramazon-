import assert from 'node:assert/strict';
import test from 'node:test';

import { formatMoney } from '../../src/lib/shopify/client.ts';
import type { Product, ProductVariant } from '../../src/lib/shopify/types.ts';
import {
  defaultSelection,
  findVariant,
  hasRealOptions,
} from '../../src/lib/shopify/variants.ts';

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

test('formats prices in the store currency', () => {
  assert.equal(formatMoney({ amount: '12.50', currencyCode: 'USD' }), '$12.50');
});

test('drops the trailing .00 on whole-dollar prices', () => {
  assert.equal(formatMoney({ amount: '12.00', currencyCode: 'USD' }), '$12');
  assert.equal(formatMoney({ amount: '12', currencyCode: 'USD' }), '$12');
});

test('falls back to a readable string for an unknown currency', () => {
  // Intl throws on a bad currency code; a bait should never render as a crash.
  const result = formatMoney({ amount: '9.99', currencyCode: 'NOTACURRENCY' });
  assert.ok(result.includes('9.99'), `unexpected fallback: "${result}"`);
});

test('renders nothing rather than NaN for a malformed amount', () => {
  assert.equal(formatMoney({ amount: '', currencyCode: 'USD' }), '');
  assert.equal(formatMoney({ amount: 'free', currencyCode: 'USD' }), '');
});

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

function variant(
  id: string,
  options: Record<string, string>,
  availableForSale = true,
): ProductVariant {
  return {
    id,
    title: Object.values(options).join(' / ') || 'Default Title',
    availableForSale,
    price: { amount: '10.00', currencyCode: 'USD' },
    compareAtPrice: null,
    image: null,
    selectedOptions: Object.entries(options).map(([name, value]) => ({ name, value })),
  };
}

function product(overrides: Partial<Product>): Product {
  return {
    id: 'gid://shopify/Product/1',
    handle: 'jig',
    title: 'Skirted Jig',
    availableForSale: true,
    featuredImage: null,
    priceRange: {
      minVariantPrice: { amount: '10.00', currencyCode: 'USD' },
      maxVariantPrice: { amount: '10.00', currencyCode: 'USD' },
    },
    description: '',
    descriptionHtml: '',
    images: [],
    options: [],
    variants: [],
    totalInventory: null,
    ...overrides,
  };
}

const twoOptionProduct = product({
  options: [
    { id: '1', name: 'Color', values: ['Chartreuse', 'Black'] },
    { id: '2', name: 'Weight', values: ['3/8oz', '1/2oz'] },
  ],
  variants: [
    variant('a', { Color: 'Chartreuse', Weight: '3/8oz' }, false),
    variant('b', { Color: 'Chartreuse', Weight: '1/2oz' }),
    variant('c', { Color: 'Black', Weight: '3/8oz' }),
  ],
});

test('finds the variant matching a full selection', () => {
  const found = findVariant(twoOptionProduct, { Color: 'Black', Weight: '3/8oz' });
  assert.equal(found?.id, 'c');
});

test('returns null for a combination the store does not sell', () => {
  // Black + 1/2oz is a plausible pairing that simply has no variant.
  assert.equal(findVariant(twoOptionProduct, { Color: 'Black', Weight: '1/2oz' }), null);
});

test('defaults to the first variant that is actually in stock', () => {
  // Variant "a" comes first but is sold out, so the page should open on "b".
  assert.deepEqual(defaultSelection(twoOptionProduct), {
    Color: 'Chartreuse',
    Weight: '1/2oz',
  });
});

test('still opens on something when every variant is sold out', () => {
  const soldOut = product({
    options: twoOptionProduct.options,
    variants: [variant('a', { Color: 'Black', Weight: '3/8oz' }, false)],
  });
  assert.deepEqual(defaultSelection(soldOut), { Color: 'Black', Weight: '3/8oz' });
});

test('handles a product with no variants at all', () => {
  assert.deepEqual(defaultSelection(product({})), {});
  assert.equal(findVariant(product({}), { Color: 'Black' }), null);
});

test('hides the picker for Shopify’s "Default Title" placeholder', () => {
  const single = product({
    options: [{ id: '1', name: 'Title', values: ['Default Title'] }],
    variants: [variant('a', {})],
  });
  assert.equal(hasRealOptions(single), false);
});

test('shows the picker when there are real choices', () => {
  assert.equal(hasRealOptions(twoOptionProduct), true);
  assert.equal(
    hasRealOptions(
      product({ options: [{ id: '1', name: 'Weight', values: ['3/8oz', '1/2oz'] }] }),
    ),
    true,
  );
});
