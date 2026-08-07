/**
 * GraphQL documents for the Storefront API.
 *
 * Kept as plain strings rather than pulling in a GraphQL client — the app makes
 * about eight distinct queries, and a codegen pipeline would cost more than it
 * saves at that size.
 */

const MONEY = `
  fragment Money on MoneyV2 {
    amount
    currencyCode
  }
`;

const IMAGE = `
  fragment Image on Image {
    url
    altText
    width
    height
  }
`;

const PRODUCT_SUMMARY = `
  fragment ProductSummary on Product {
    id
    handle
    title
    availableForSale
    featuredImage { ...Image }
    priceRange {
      minVariantPrice { ...Money }
      maxVariantPrice { ...Money }
    }
  }
`;

const CART = `
  fragment CartDetail on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount { ...Money }
      totalAmount { ...Money }
      totalTaxAmount { ...Money }
    }
    lines(first: 100) {
      edges {
        node {
          id
          quantity
          cost { totalAmount { ...Money } }
          merchandise {
            ... on ProductVariant {
              id
              title
              image { ...Image }
              price { ...Money }
              product {
                handle
                title
                featuredImage { ...Image }
              }
            }
          }
        }
      }
    }
  }
`;

/** A page of products, newest first. `query` is Shopify's search syntax. */
export const PRODUCTS_QUERY = `
  ${MONEY}
  ${IMAGE}
  ${PRODUCT_SUMMARY}
  query Products($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query, sortKey: BEST_SELLING) {
      edges {
        cursor
        node { ...ProductSummary }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/** Storefront "collections" are what a shopper thinks of as categories. */
export const COLLECTIONS_QUERY = `
  ${IMAGE}
  query Collections($first: Int!) {
    collections(first: $first, sortKey: TITLE) {
      edges {
        node {
          id
          handle
          title
          image { ...Image }
        }
      }
    }
  }
`;

/** Products inside one collection. */
export const COLLECTION_PRODUCTS_QUERY = `
  ${MONEY}
  ${IMAGE}
  ${PRODUCT_SUMMARY}
  query CollectionProducts($handle: String!, $first: Int!, $after: String) {
    collection(handle: $handle) {
      id
      title
      products(first: $first, after: $after) {
        edges { node { ...ProductSummary } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

export const PRODUCT_QUERY = `
  ${MONEY}
  ${IMAGE}
  ${PRODUCT_SUMMARY}
  query Product($handle: String!) {
    product(handle: $handle) {
      ...ProductSummary
      description
      descriptionHtml
      totalInventory
      images(first: 10) {
        edges { node { ...Image } }
      }
      options {
        id
        name
        values
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            availableForSale
            price { ...Money }
            compareAtPrice { ...Money }
            image { ...Image }
            selectedOptions { name value }
          }
        }
      }
    }
  }
`;

export const CART_QUERY = `
  ${MONEY}
  ${IMAGE}
  ${CART}
  query CartQuery($id: ID!) {
    cart(id: $id) { ...CartDetail }
  }
`;

export const CART_CREATE_MUTATION = `
  ${MONEY}
  ${IMAGE}
  ${CART}
  mutation CartCreate($lines: [CartLineInput!]) {
    cartCreate(input: { lines: $lines }) {
      cart { ...CartDetail }
      userErrors { field message }
    }
  }
`;

export const CART_LINES_ADD_MUTATION = `
  ${MONEY}
  ${IMAGE}
  ${CART}
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ...CartDetail }
      userErrors { field message }
    }
  }
`;

export const CART_LINES_UPDATE_MUTATION = `
  ${MONEY}
  ${IMAGE}
  ${CART}
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { ...CartDetail }
      userErrors { field message }
    }
  }
`;

export const CART_LINES_REMOVE_MUTATION = `
  ${MONEY}
  ${IMAGE}
  ${CART}
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ...CartDetail }
      userErrors { field message }
    }
  }
`;
