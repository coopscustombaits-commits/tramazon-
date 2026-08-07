/**
 * Shopify Storefront API client.
 *
 * The Storefront API is designed to be called from a client — its access token
 * is public and scoped to reading products and managing carts. It cannot touch
 * orders, customers, or inventory. (The *Admin* API token is a different thing
 * entirely and must never appear in this app.)
 *
 * Docs: https://shopify.dev/docs/api/storefront
 */

const DEFAULT_API_VERSION = '2026-04';

export type ShopifyConfig = {
  domain: string;
  token: string;
  apiVersion: string;
};

export function shopifyConfig(): ShopifyConfig | null {
  const domain = process.env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const token = process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;
  if (!domain || !token) return null;

  return {
    domain: domain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    token,
    apiVersion: process.env.EXPO_PUBLIC_SHOPIFY_API_VERSION || DEFAULT_API_VERSION,
  };
}

/** Whether the store is set up. The Shop tab explains itself when it isn't. */
export function isShopConfigured(): boolean {
  return shopifyConfig() !== null;
}

export class ShopifyError extends Error {
  readonly userMessage: string;

  constructor(message: string, userMessage = 'The store is unavailable right now.') {
    super(message);
    this.name = 'ShopifyError';
    this.userMessage = userMessage;
  }
}

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

/**
 * Run a GraphQL query against the Storefront API.
 *
 * Shopify answers with HTTP 200 and an `errors` array for query problems, so
 * checking `response.ok` alone isn't enough.
 */
export async function storefront<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const config = shopifyConfig();
  if (!config) {
    throw new ShopifyError(
      'Shopify is not configured.',
      'The store isn’t set up yet. Check back soon.',
    );
  }

  const endpoint = `https://${config.domain}/api/${config.apiVersion}/graphql.json`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Shopify-Storefront-Access-Token': config.token,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (error) {
    throw new ShopifyError(
      `Network failure calling Shopify: ${String(error)}`,
      'Couldn’t reach the store. Check your connection and try again.',
    );
  }

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new ShopifyError(
        `Storefront token rejected (${response.status}): ${body}`,
        'The store isn’t configured correctly. We’re on it.',
      );
    }
    if (response.status === 430 || response.status === 429) {
      throw new ShopifyError(
        `Rate limited by Shopify (${response.status})`,
        'The store is busy. Give it a moment and try again.',
      );
    }
    throw new ShopifyError(`Shopify returned ${response.status}: ${body}`);
  }

  const payload = (await response.json()) as GraphQLResponse<T>;

  if (payload.errors?.length) {
    throw new ShopifyError(
      `Storefront query failed: ${payload.errors.map((e) => e.message).join('; ')}`,
    );
  }
  if (!payload.data) {
    throw new ShopifyError('Storefront returned no data.');
  }

  return payload.data;
}

/** Format a Shopify money object, e.g. `{ amount: "12.50", currencyCode: "USD" }`. */
export function formatMoney(money: { amount: string; currencyCode: string }): string {
  const amount = Number.parseFloat(money.amount);
  if (Number.isNaN(amount)) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: money.currencyCode,
      // Whole-dollar prices read better without the trailing ".00".
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${money.currencyCode} ${amount.toFixed(2)}`;
  }
}
