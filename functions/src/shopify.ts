import { createHmac, timingSafeEqual } from 'node:crypto';

import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';

import { notifyUser } from './push';

/**
 * Shopify order webhooks.
 *
 * The app records an order the moment checkout opens, because the customer may
 * complete the purchase and never come back to the app. What it can't know is
 * what happened next — paid, shipped, cancelled — because that happens on
 * Shopify's side. This is Shopify telling us.
 *
 * The signing secret lives in Secret Manager, not in the repo and not in the
 * app. It's the one Admin-API-adjacent credential in the whole project, and
 * the reason it can be here safely is that Cloud Functions run on Google's
 * servers where a phone can't read them.
 */
const SHOPIFY_WEBHOOK_SECRET = defineSecret('SHOPIFY_WEBHOOK_SECRET');

/**
 * Verify the request really came from Shopify.
 *
 * Shopify signs the **raw body** with the shared secret. Two things matter
 * here and both are easy to get wrong:
 *
 *   - it has to be the raw bytes, not the parsed JSON re-serialized, because
 *     re-serializing changes key order and whitespace and the signature
 *     stops matching;
 *   - the comparison has to be constant-time, or the failure timing leaks the
 *     signature a byte at a time.
 */
function isFromShopify(rawBody: Buffer, header: string | undefined, secret: string): boolean {
  if (!header || !secret) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(header, 'base64');
  } catch {
    return false;
  }

  // timingSafeEqual throws on a length mismatch rather than returning false.
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

/** Shopify's financial and fulfillment states, mapped to ours. */
function statusFor(order: Record<string, unknown>): string {
  if (order.cancelled_at) return 'cancelled';

  const financial = String(order.financial_status ?? '');
  if (financial === 'refunded' || financial === 'partially_refunded') return 'refunded';

  const fulfillment = String(order.fulfillment_status ?? '');
  if (fulfillment === 'fulfilled') return 'fulfilled';
  if (fulfillment === 'partial') return 'partially_fulfilled';

  if (financial === 'paid') return 'paid';
  return 'placed';
}

type Fulfillment = {
  tracking_numbers?: string[];
  tracking_urls?: string[];
};

/**
 * Receive an order webhook and update the matching order document.
 *
 * Orders are matched on the **cart id**, which the app recorded when it opened
 * checkout and which Shopify carries through to the order. Matching on email
 * would break for anyone who checks out as a guest with a different address,
 * and there is no other identifier that exists on both sides.
 *
 * Always answers 200 once the signature checks out, even when there's nothing
 * to update. Shopify retries non-2xx responses for two days, and an order we
 * have no record of — someone buying from the website — is a normal state, not
 * a failure worth retrying.
 */
export const shopifyOrderWebhook = onRequest(
  { secrets: [SHOPIFY_WEBHOOK_SECRET], cors: false },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).send('Method not allowed');
      return;
    }

    // `rawBody` is populated by the Functions framework precisely for this.
    const raw = request.rawBody;
    const signature = request.get('X-Shopify-Hmac-Sha256');

    if (!raw || !isFromShopify(raw, signature, SHOPIFY_WEBHOOK_SECRET.value())) {
      logger.warn('Rejected a webhook with a bad or missing signature');
      response.status(401).send('Bad signature');
      return;
    }

    const order = request.body as Record<string, unknown>;
    const cartId =
      typeof order.cart_token === 'string'
        ? order.cart_token
        : typeof order.checkout_token === 'string'
          ? order.checkout_token
          : null;

    if (!cartId) {
      logger.info('Webhook had no cart token; nothing to match', {
        topic: request.get('X-Shopify-Topic'),
      });
      response.status(200).send('No cart token');
      return;
    }

    // A collection-group query, because orders live under each user and we
    // only know the cart. One composite index covers it.
    const matches = await getFirestore()
      .collectionGroup('orders')
      .where('cartId', '==', cartId)
      .limit(1)
      .get();

    if (matches.empty) {
      logger.info('No app order matches this cart', { cartId });
      response.status(200).send('No matching order');
      return;
    }

    const document = matches.docs[0];
    const before = document.get('status') as string | undefined;
    const status = statusFor(order);

    const fulfillments = Array.isArray(order.fulfillments)
      ? (order.fulfillments as Fulfillment[])
      : [];
    const trackingNumbers = fulfillments.flatMap((entry) => entry.tracking_numbers ?? []);
    const trackingUrls = fulfillments.flatMap((entry) => entry.tracking_urls ?? []);

    await document.ref.update({
      status,
      shopifyOrderId: order.id != null ? String(order.id) : null,
      orderNumber: typeof order.name === 'string' ? order.name : null,
      statusUrl: typeof order.order_status_url === 'string' ? order.order_status_url : null,
      fulfilledAt: status === 'fulfilled' ? new Date() : null,
      trackingNumbers,
      trackingUrls,
      updatedAt: new Date(),
    });

    // The uid is the grandparent of the order document: users/{uid}/orders/{id}
    const uid = document.ref.parent.parent?.id;
    if (uid && status !== before && (status === 'fulfilled' || status === 'cancelled')) {
      await notifyUser(uid, {
        type: 'announcement',
        title: status === 'fulfilled' ? 'Your order shipped' : 'Your order was cancelled',
        body:
          status === 'fulfilled'
            ? `${order.name ?? 'Your order'} is on its way.`
            : `${order.name ?? 'Your order'} was cancelled.`,
        href: '/orders',
        data: { orderId: document.id },
      });
    }

    logger.info('Order updated from webhook', { cartId, status });
    response.status(200).send('OK');
  },
);
