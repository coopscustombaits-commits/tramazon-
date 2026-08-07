/** Shapes returned by the Storefront API queries in `queries.ts`. */

export type Money = {
  amount: string;
  currencyCode: string;
};

export type ShopifyImage = {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
};

export type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: Money;
  compareAtPrice: Money | null;
  image: ShopifyImage | null;
  /** e.g. [{ name: 'Color', value: 'Chartreuse' }] */
  selectedOptions: { name: string; value: string }[];
};

export type ProductOption = {
  id: string;
  name: string;
  values: string[];
};

export type Collection = {
  id: string;
  handle: string;
  title: string;
  image: ShopifyImage | null;
};

/** Just enough to render a product tile. */
export type ProductSummary = {
  id: string;
  handle: string;
  title: string;
  availableForSale: boolean;
  featuredImage: ShopifyImage | null;
  priceRange: {
    minVariantPrice: Money;
    maxVariantPrice: Money;
  };
};

export type Product = ProductSummary & {
  description: string;
  descriptionHtml: string;
  images: ShopifyImage[];
  options: ProductOption[];
  variants: ProductVariant[];
  totalInventory: number | null;
};

export type CartLine = {
  id: string;
  quantity: number;
  cost: { totalAmount: Money };
  merchandise: {
    id: string;
    title: string;
    image: ShopifyImage | null;
    price: Money;
    product: {
      handle: string;
      title: string;
      featuredImage: ShopifyImage | null;
    };
  };
};

export type Cart = {
  id: string;
  /** The hosted Shopify checkout. Opening this is how an order gets placed. */
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
    totalTaxAmount: Money | null;
  };
  lines: CartLine[];
};
