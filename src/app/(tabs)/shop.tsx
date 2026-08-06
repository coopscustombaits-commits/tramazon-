import { AppHeader } from '@/components/app-header';
import { ComingSoon } from '@/components/coming-soon';
import { Screen } from '@/components/ui/screen';

/** Shopify Storefront API store. Built in Phase 1, step 3. */
export default function ShopScreen() {
  return (
    <Screen padded={false}>
      <AppHeader title="Shop" />
      <ComingSoon
        title="The store is coming"
        icon="bag-handle-outline"
        summary="Pulled live from the Shopify store, so inventory and pricing stay in one place."
        items={[
          'Product list and detail pages',
          'Cart that survives app restarts',
          "Checkout handled by Shopify's own flow",
        ]}
      />
    </Screen>
  );
}
