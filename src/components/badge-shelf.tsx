import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Spacing, Typography } from '@/constants/theme';
import { makeStyles, useThemeColors } from '@/constants/theme-context';
import { subscribeToBadgeAwards } from '@/lib/db/rewards';
import type { BadgeAward } from '@/types/models';

/**
 * The badges one angler has earned, as a horizontal shelf.
 *
 * Renders nothing at all when there are none — an empty shelf on a new
 * profile reads as "you're behind" rather than "there's something to earn",
 * and the leaderboard screen is where the goals are explained.
 */
export function BadgeShelf({ uid }: { uid: string }) {
  const Colors = useThemeColors();
  const styles = useStyles();
  const [awards, setAwards] = useState<BadgeAward[]>([]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToBadgeAwards(uid, setAwards, (error) =>
      console.warn('[badges] load failed', error),
    );
  }, [uid]);

  if (awards.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Badges</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.shelf}>
        {awards.map((award) => (
          <Pressable
            key={award.id}
            accessibilityRole="button"
            accessibilityLabel={`${award.title}. ${award.description}`}
            onPress={() => Alert.alert(award.title, award.description)}
            style={({ pressed }) => [styles.badge, pressed && styles.badgePressed]}>
            <View style={styles.medal}>
              <Ionicons
                // A badge definition can name any icon; fall back rather than
                // render a blank square if Coop typos one.
                name={(award.icon as keyof typeof Ionicons.glyphMap) || 'ribbon'}
                size={22}
                color={Colors.accent}
              />
            </View>
            <Text style={styles.label} numberOfLines={2}>
              {award.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  section: { gap: Spacing.sm },
  title: { ...Typography.bodyStrong, color: Colors.text },
  shelf: { gap: Spacing.md, paddingVertical: Spacing.xs },
  badge: { width: 76, alignItems: 'center', gap: Spacing.xs },
  badgePressed: { opacity: 0.7 },
  medal: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center' },
}));
