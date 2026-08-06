import { AppHeader } from '@/components/app-header';
import { ComingSoon } from '@/components/coming-soon';
import { Screen } from '@/components/ui/screen';

/** Create a catch post. Built in Phase 1, step 4. */
export default function CreatePostScreen() {
  return (
    <Screen padded={false}>
      <AppHeader title="New Catch" />
      <ComingSoon
        title="Posting comes next"
        icon="camera-outline"
        summary="Pick a photo, write a caption, and send it in for review."
        items={[
          'Photo upload to Firebase Storage',
          'Posts start as pending, not public',
          'Coop gets a push notification to review it',
        ]}
      />
    </Screen>
  );
}
