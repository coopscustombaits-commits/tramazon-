import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { FlatList, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { SPECIES_HUBS } from '@/constants/species-hubs';

/**
 * The species hubs — a filtered feed per fish.
 *
 * The list is curated rather than derived from what's been posted: an empty
 * hub reads as "nobody's caught one yet", which is inviting, whereas a list
 * that only shows species with existing posts hides the ones worth filling.
 */
export default function SpeciesIndexScreen() {
  const router = useRouter();
  const Colors = useThemeColors();
  const styles = useStyles();

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: 'Species' }} />

      <FlatList
        data={SPECIES_HUBS}
        keyExtractor={(hub) => hub.slug}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.intro}>
            Every catch tagged with a species lands in its hub. Tag yours when you post.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/species/${item.slug}`)}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
            <Ionicons name="fish" size={26} color={Colors.primary} />
            <Text style={styles.title}>{item.label}</Text>
            {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const useStyles = makeStyles((Colors) => ({
  screen: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  row: { gap: Spacing.lg },
  intro: { ...Typography.body, color: Colors.textMuted, marginBottom: Spacing.md },
  tile: {
    flex: 1,
    gap: Spacing.xs,
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tilePressed: { backgroundColor: Colors.primaryTint },
  title: { ...Typography.bodyStrong, color: Colors.text, textAlign: 'center' },
  note: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center' },
}));
