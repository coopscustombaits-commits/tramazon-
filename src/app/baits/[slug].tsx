import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReviewsSection } from '@/components/reviews-section';
import { EmptyState } from '@/components/ui/screen';
import { Spacing, Typography } from '@/constants/theme';
import { makeStyles } from '@/constants/theme-context';
import { labelFromSlug } from '@/lib/slug';

/**
 * One bait's community reviews.
 *
 * The display name arrives as a param when you got here from the list or from
 * typing a name; falling back to the slug means a shared or deep-linked URL
 * still renders something readable ("ned-rig" → "Ned Rig") instead of blank.
 */
export default function BaitScreen() {
  const { slug, name } = useLocalSearchParams<{ slug: string; name?: string }>();
  const router = useRouter();
  const styles = useStyles();

  if (!slug) {
    return <EmptyState title="Bait not found" message="Try searching for it again." />;
  }

  const title = name?.trim() || labelFromSlug(slug);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          Community reviews. Say where you fished it and what it did — that&apos;s the part
          people actually use.
        </Text>
        <ReviewsSection
          kind="bait"
          subjectId={slug}
          subjectTitle={title}
          onPressAuthor={(uid) => router.push(`/user/${uid}`)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  title: { ...Typography.title, color: Colors.text },
  subtitle: { ...Typography.body, color: Colors.textMuted },
}));
