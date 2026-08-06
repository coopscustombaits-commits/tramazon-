import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

/**
 * Placeholder for the Phase 1 features that come after authentication. These
 * are deliberately obvious rather than half-built UI, so nothing looks
 * finished before it is.
 */
export function ComingSoon({
  title,
  icon,
  summary,
  items,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  summary: string;
  items: string[];
}) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={34} color={Colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.summary}>{summary}</Text>
      <View style={styles.list}>
        {items.map((item) => (
          <View key={item} style={styles.listItem}>
            <Ionicons name="ellipse" size={6} color={Colors.accent} />
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.title,
    textAlign: 'center',
  },
  summary: {
    ...Typography.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  list: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  listText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
});
