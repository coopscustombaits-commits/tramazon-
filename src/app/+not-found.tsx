import { Stack, useRouter } from 'expo-router';

import { Button } from '@/components/ui/button';
import { EmptyState, Screen } from '@/components/ui/screen';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen>
        <EmptyState
          title="Nothing here"
          message="That link doesn't go anywhere in the app."
          action={
            <Button
              label="Back to the feed"
              fullWidth={false}
              onPress={() => router.replace('/(tabs)')}
            />
          }
        />
      </Screen>
    </>
  );
}
