import { ComingSoon } from '@/components/coming-soon';
import { Screen } from '@/components/ui/screen';
import { AppHeader } from '@/components/app-header';

/** Home feed — approved catches. Built in Phase 1, step 4. */
export default function FeedScreen() {
  return (
    <Screen padded={false}>
      <AppHeader title="The Feed" />
      <ComingSoon
        title="The feed is next"
        icon="fish-outline"
        summary="Approved catches from the crew will land here."
        items={[
          'Photo + caption posts',
          'Likes and comments once a post is approved',
          'Pull to refresh, infinite scroll',
        ]}
      />
    </Screen>
  );
}
