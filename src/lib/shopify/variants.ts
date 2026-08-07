import type { Product, ProductVariant } from './types.ts';

/**
 * Variant selection logic. Pure, and importing only types, so it can be unit
 * tested without a network or a bundler. `store.ts` re-exports it.
 */

/** The variant matching a set of chosen options, e.g. { Color: 'Chartreuse' }. */
export function findVariant(
  product: Product,
  selection: Record<string, string>,
): ProductVariant | null {
  return (
    product.variants.find((variant) =>
      variant.selectedOptions.every((option) => selection[option.name] === option.value),
    ) ?? null
  );
}

/**
 * Sensible starting selection: the first variant that's actually in stock,
 * falling back to the first one so the page still renders for a sold-out item.
 */
export function defaultSelection(product: Product): Record<string, string> {
  const variant =
    product.variants.find((entry) => entry.availableForSale) ?? product.variants[0];
  if (!variant) return {};

  return Object.fromEntries(
    variant.selectedOptions.map((option) => [option.name, option.value]),
  );
}

/**
 * Products with a single unnamed variant ("Default Title") shouldn't show an
 * option picker — that's Shopify's placeholder, not a real choice.
 */
export function hasRealOptions(product: Product): boolean {
  if (product.options.length === 0) return false;
  if (product.options.length === 1 && product.options[0].values.length <= 1) return false;
  return true;
}
